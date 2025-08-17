import Foundation
import Combine

class TimeTrackingViewModel: ObservableObject {
    @Published var currentWeekStart = Date().mondayOfWeek()
    @Published var timeEntries: [TimeEntry] = []
    @Published var employees: [Employee] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    private let dataStore = DataStore.shared
    
    private let weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    private let weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    init() {
        dataStore.$timeEntries
            .assign(to: \.timeEntries, on: self)
            .store(in: &cancellables)
        
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
    
    func loadData() {
        dataStore.loadEmployees()
        dataStore.loadTimeEntries(for: currentWeekStart)
    }
    
    func previousWeek() {
        currentWeekStart = Calendar.current.date(byAdding: .day, value: -7, to: currentWeekStart) ?? currentWeekStart
        dataStore.loadTimeEntries(for: currentWeekStart)
    }
    
    func nextWeek() {
        currentWeekStart = Calendar.current.date(byAdding: .day, value: 7, to: currentWeekStart) ?? currentWeekStart
        dataStore.loadTimeEntries(for: currentWeekStart)
    }
    
    func goToCurrentWeek() {
        currentWeekStart = Date().mondayOfWeek()
        dataStore.loadTimeEntries(for: currentWeekStart)
    }
    
    func updateTimeEntry(employeeId: Int, day: String, status: TimeStatus) {
        dataStore.updateTimeEntry(
            employeeId: employeeId,
            weekStart: currentWeekStart,
            day: day,
            status: status
        )
    }
    
    func getTimeEntry(for employeeId: Int) -> TimeEntry? {
        return timeEntries.first { $0.employee_id == employeeId }
    }
    
    func getStatus(for employeeId: Int, day: String) -> TimeStatus {
        guard let timeEntry = getTimeEntry(for: employeeId) else {
            return .empty
        }
        return timeEntry.statusForDay(day)
    }
    
    func getWeekdayNames() -> [String] {
        return weekdayNames
    }
    
    func getWeekdays() -> [String] {
        return weekdays
    }
    
    func getWeekRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        
        let startDate = currentWeekStart
        let endDate = Calendar.current.date(byAdding: .day, value: 6, to: startDate) ?? startDate
        
        let startString = formatter.string(from: startDate)
        let endString = formatter.string(from: endDate)
        
        return "\(startString) - \(endString)"
    }
    
    func clearError() {
        dataStore.clearError()
    }
}