import Foundation
import Combine

class APIService: ObservableObject {
    static let shared = APIService()
    
    @Published var baseURL: String = "http://localhost:3000/api"
    @Published var isAuthenticated = false
    
    private var session: URLSession
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        self.session = URLSession(configuration: config)
    }
    
    func updateBaseURL(_ url: String) {
        baseURL = url.hasSuffix("/api") ? url : url + "/api"
    }
    
    private func createRequest(endpoint: String, method: HTTPMethod = .GET, body: Data? = nil) -> URLRequest? {
        guard let url = URL(string: baseURL + endpoint) else {
            print("Invalid URL: \(baseURL + endpoint)")
            return nil
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let body = body {
            request.httpBody = body
        }
        
        return request
    }
    
    private func handleResponse<T: Codable>(_ data: Data, _ response: URLResponse, type: T.Type) -> Result<T, APIError> {
        guard let httpResponse = response as? HTTPURLResponse else {
            return .failure(.networkError)
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            do {
                let decoded = try JSONDecoder().decode(T.self, from: data)
                return .success(decoded)
            } catch {
                print("Decoding error: \(error)")
                return .failure(.decodingError)
            }
        case 401:
            DispatchQueue.main.async {
                self.isAuthenticated = false
            }
            return .failure(.unauthorized)
        case 404:
            return .failure(.notFound)
        case 400...499:
            return .failure(.clientError)
        case 500...599:
            return .failure(.serverError)
        default:
            return .failure(.networkError)
        }
    }
}

extension APIService {
    func login(username: String, password: String) -> AnyPublisher<LoginResponse, APIError> {
        let loginRequest = LoginRequest(username: username, password: password)
        
        guard let body = try? JSONEncoder().encode(loginRequest),
              let request = createRequest(endpoint: "/login", method: .POST, body: body) else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: LoginResponse.self)
            }
            .map { result in
                switch result {
                case .success(let loginResponse):
                    if loginResponse.success {
                        DispatchQueue.main.async {
                            self.isAuthenticated = true
                        }
                    }
                    return loginResponse
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<LoginResponse, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func logout() -> AnyPublisher<LoginResponse, APIError> {
        guard let request = createRequest(endpoint: "/logout", method: .POST) else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                let result = self.handleResponse(data, response, type: LoginResponse.self)
                DispatchQueue.main.async {
                    self.isAuthenticated = false
                }
                return result
            }
            .map { result in
                switch result {
                case .success(let response):
                    return response
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<LoginResponse, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func checkAuth() -> AnyPublisher<AuthCheckResponse, APIError> {
        guard let request = createRequest(endpoint: "/check-auth") else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: AuthCheckResponse.self)
            }
            .map { result in
                switch result {
                case .success(let authResponse):
                    DispatchQueue.main.async {
                        self.isAuthenticated = authResponse.authenticated
                    }
                    return authResponse
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<AuthCheckResponse, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
}

extension APIService {
    func getEmployees() -> AnyPublisher<[Employee], APIError> {
        guard let request = createRequest(endpoint: "/employees") else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: [Employee].self)
            }
            .map { result in
                switch result {
                case .success(let employees):
                    return employees
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<[Employee], APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func addEmployee(name: String) -> AnyPublisher<Employee, APIError> {
        let addRequest = AddEmployeeRequest(name: name)
        
        guard let body = try? JSONEncoder().encode(addRequest),
              let request = createRequest(endpoint: "/employees", method: .POST, body: body) else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: Employee.self)
            }
            .map { result in
                switch result {
                case .success(let employee):
                    return employee
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<Employee, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func updateEmployee(id: Int, name: String) -> AnyPublisher<APIResponse<Employee>, APIError> {
        let updateRequest = UpdateEmployeeRequest(name: name)
        
        guard let body = try? JSONEncoder().encode(updateRequest),
              let request = createRequest(endpoint: "/employees/\(id)", method: .PUT, body: body) else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: APIResponse<Employee>.self)
            }
            .map { result in
                switch result {
                case .success(let response):
                    return response
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<APIResponse<Employee>, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func deleteEmployee(id: Int) -> AnyPublisher<APIResponse<Employee>, APIError> {
        guard let request = createRequest(endpoint: "/employees/\(id)", method: .DELETE) else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: APIResponse<Employee>.self)
            }
            .map { result in
                switch result {
                case .success(let response):
                    return response
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<APIResponse<Employee>, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
}

extension APIService {
    func getTimeEntries(weekStart: String) -> AnyPublisher<[TimeEntry], APIError> {
        guard let request = createRequest(endpoint: "/time-entries/\(weekStart)") else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: [TimeEntry].self)
            }
            .map { result in
                switch result {
                case .success(let timeEntries):
                    return timeEntries
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<[TimeEntry], APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func updateTimeEntry(employeeId: Int, weekStart: String, day: String, status: TimeStatus) -> AnyPublisher<APIResponse<TimeEntry>, APIError> {
        let updateRequest = TimeEntryUpdate(
            employeeId: employeeId,
            weekStart: weekStart,
            day: day,
            status: status.rawValue
        )
        
        guard let body = try? JSONEncoder().encode(updateRequest),
              let request = createRequest(endpoint: "/time-entries", method: .POST, body: body) else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: APIResponse<TimeEntry>.self)
            }
            .map { result in
                switch result {
                case .success(let response):
                    return response
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<APIResponse<TimeEntry>, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
}

extension APIService {
    func getAnalyticsSummary(start: String, end: String, includeAll: Bool = true) -> AnyPublisher<AnalyticsSummary, APIError> {
        let queryItems = [
            "start": start,
            "end": end,
            "includeAll": includeAll ? "true" : "false"
        ]
        
        let queryString = queryItems.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        
        guard let request = createRequest(endpoint: "/analytics/summary?\(queryString)") else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: AnalyticsSummary.self)
            }
            .map { result in
                switch result {
                case .success(let summary):
                    return summary
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<AnalyticsSummary, APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
    
    func getAnalyticsByEmployee(start: String, end: String, includeAll: Bool = false) -> AnyPublisher<[EmployeeAnalytics], APIError> {
        let queryItems = [
            "start": start,
            "end": end,
            "includeAll": includeAll ? "true" : "false"
        ]
        
        let queryString = queryItems.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        
        guard let request = createRequest(endpoint: "/analytics/by-employee?\(queryString)") else {
            return Fail(error: APIError.invalidRequest)
                .eraseToAnyPublisher()
        }
        
        return session.dataTaskPublisher(for: request)
            .map { data, response in
                self.handleResponse(data, response, type: [EmployeeAnalytics].self)
            }
            .map { result in
                switch result {
                case .success(let analytics):
                    return analytics
                case .failure(let error):
                    throw error
                }
            }
            .catch { error -> AnyPublisher<[EmployeeAnalytics], APIError> in
                return Fail(error: error as? APIError ?? APIError.networkError)
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }
}

enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
}

enum APIError: Error, LocalizedError {
    case invalidRequest
    case networkError
    case unauthorized
    case notFound
    case clientError
    case serverError
    case decodingError
    
    var errorDescription: String? {
        switch self {
        case .invalidRequest:
            return "Invalid request"
        case .networkError:
            return "Network error occurred"
        case .unauthorized:
            return "Unauthorized access"
        case .notFound:
            return "Resource not found"
        case .clientError:
            return "Client error"
        case .serverError:
            return "Server error"
        case .decodingError:
            return "Failed to decode response"
        }
    }
}