import Foundation
import Combine

class DataStore: ObservableObject {
    static let shared = DataStore()
    
    @Published var employees: [Employee] = []
    @Published var timeEntries: [TimeEntry] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    private let apiService = APIService.shared
    
    private init() {}
    
    func setServerURL(_ url: String) {
        apiService.updateBaseURL(url)
        UserDefaults.standard.set(url, forKey: "serverURL")
    }
    
    func getServerURL() -> String {
        return UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3000"
    }
    
    func loadEmployees() {
        isLoading = true
        errorMessage = nil
        
        apiService.getEmployees()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { [weak self] employees in
                    self?.employees = employees
                }
            )
            .store(in: &cancellables)
    }
    
    func addEmployee(name: String) {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Employee name cannot be empty"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        apiService.addEmployee(name: name.trimmingCharacters(in: .whitespacesAndNewlines))
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { [weak self] newEmployee in
                    self?.employees.append(newEmployee)
                }
            )
            .store(in: &cancellables)
    }
    
    func updateEmployee(id: Int, name: String) {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Employee name cannot be empty"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        apiService.updateEmployee(id: id, name: name.trimmingCharacters(in: .whitespacesAndNewlines))
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    } else {
                        self?.loadEmployees()
                    }
                },
                receiveValue: { _ in
                }
            )
            .store(in: &cancellables)
    }
    
    func deleteEmployee(id: Int) {
        isLoading = true
        errorMessage = nil
        
        apiService.deleteEmployee(id: id)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    } else {
                        self?.employees.removeAll { $0.id == id }
                        self?.timeEntries.removeAll { $0.employee_id == id }
                    }
                },
                receiveValue: { _ in
                }
            )
            .store(in: &cancellables)
    }
    
    func loadTimeEntries(for weekStart: Date) {
        let weekStartString = weekStart.formatAsWeekStart()
        
        isLoading = true
        errorMessage = nil
        
        apiService.getTimeEntries(weekStart: weekStartString)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { [weak self] timeEntries in
                    self?.timeEntries = timeEntries
                }
            )
            .store(in: &cancellables)
    }
    
    func updateTimeEntry(employeeId: Int, weekStart: Date, day: String, status: TimeStatus) {
        let weekStartString = weekStart.formatAsWeekStart()
        
        isLoading = true
        errorMessage = nil
        
        apiService.updateTimeEntry(
            employeeId: employeeId,
            weekStart: weekStartString,
            day: day,
            status: status
        )
        .receive(on: DispatchQueue.main)
        .sink(
            receiveCompletion: { [weak self] completion in
                self?.isLoading = false
                if case .failure(let error) = completion {
                    self?.errorMessage = error.localizedDescription
                } else {
                    self?.loadTimeEntries(for: weekStart)
                }
            },
            receiveValue: { _ in
            }
        )
        .store(in: &cancellables)
    }
    
    func clearError() {
        errorMessage = nil
    }
}