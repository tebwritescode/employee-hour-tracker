import Foundation
import Combine

class EmployeeViewModel: ObservableObject {
    @Published var employees: [Employee] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showingAddEmployee = false
    @Published var showingEditEmployee = false
    @Published var selectedEmployee: Employee?
    @Published var newEmployeeName = ""
    @Published var editEmployeeName = ""
    
    private var cancellables = Set<AnyCancellable>()
    private let dataStore = DataStore.shared
    
    init() {
        dataStore.$employees
            .assign(to: \.employees, on: self)
            .store(in: &cancellables)
        
        dataStore.$isLoading
            .assign(to: \.isLoading, on: self)
            .store(in: &cancellables)
        
        dataStore.$errorMessage
            .assign(to: \.errorMessage, on: self)
            .store(in: &cancellables)
    }
    
    func loadEmployees() {
        dataStore.loadEmployees()
    }
    
    func addEmployee() {
        guard !newEmployeeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Employee name cannot be empty"
            return
        }
        
        dataStore.addEmployee(name: newEmployeeName.trimmingCharacters(in: .whitespacesAndNewlines))
        newEmployeeName = ""
        showingAddEmployee = false
    }
    
    func startEditingEmployee(_ employee: Employee) {
        selectedEmployee = employee
        editEmployeeName = employee.name
        showingEditEmployee = true
    }
    
    func updateEmployee() {
        guard let employee = selectedEmployee,
              !editEmployeeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Employee name cannot be empty"
            return
        }
        
        dataStore.updateEmployee(id: employee.id, name: editEmployeeName.trimmingCharacters(in: .whitespacesAndNewlines))
        editEmployeeName = ""
        selectedEmployee = nil
        showingEditEmployee = false
    }
    
    func deleteEmployee(_ employee: Employee) {
        dataStore.deleteEmployee(id: employee.id)
    }
    
    func cancelAddEmployee() {
        newEmployeeName = ""
        showingAddEmployee = false
        clearError()
    }
    
    func cancelEditEmployee() {
        editEmployeeName = ""
        selectedEmployee = nil
        showingEditEmployee = false
        clearError()
    }
    
    func clearError() {
        dataStore.clearError()
    }
}