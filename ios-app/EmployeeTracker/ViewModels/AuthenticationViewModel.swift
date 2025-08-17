import Foundation
import Combine

class AuthenticationViewModel: ObservableObject {
    @Published var username = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var serverURL = ""
    @Published var showServerSettings = false
    
    private var cancellables = Set<AnyCancellable>()
    private let apiService = APIService.shared
    private let dataStore = DataStore.shared
    
    init() {
        serverURL = dataStore.getServerURL()
        apiService.updateBaseURL(serverURL)
    }
    
    func login() {
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            errorMessage = "Please enter both username and password"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        apiService.login(username: username.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        self?.password = ""
                        self?.errorMessage = nil
                        self?.dataStore.loadEmployees()
                    } else {
                        self?.errorMessage = "Login failed. Please check your credentials."
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    func updateServerURL() {
        guard !serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Please enter a valid server URL"
            return
        }
        
        let cleanURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        dataStore.setServerURL(cleanURL)
        apiService.updateBaseURL(cleanURL)
        showServerSettings = false
        errorMessage = nil
    }
    
    func resetToDefaults() {
        serverURL = "http://localhost:3000"
        username = "admin"
        password = "admin123"
        updateServerURL()
    }
    
    func clearError() {
        errorMessage = nil
    }
}