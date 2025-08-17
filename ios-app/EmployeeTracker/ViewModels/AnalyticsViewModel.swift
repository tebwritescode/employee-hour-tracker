import Foundation
import Combine

class AnalyticsViewModel: ObservableObject {
    @Published var summary: AnalyticsSummary?
    @Published var employeeAnalytics: [EmployeeAnalytics] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var dateRange = DateRange.thisMonth
    @Published var includeAll = true
    
    private var cancellables = Set<AnyCancellable>()
    private let apiService = APIService.shared
    
    enum DateRange: String, CaseIterable {
        case thisWeek = "This Week"
        case thisMonth = "This Month"
        case lastMonth = "Last Month"
        case custom = "Custom"
        
        func getDateRange() -> (start: Date, end: Date) {
            let calendar = Calendar.current
            let now = Date()
            
            switch self {
            case .thisWeek:
                let startOfWeek = now.mondayOfWeek()
                let endOfWeek = calendar.date(byAdding: .day, value: 6, to: startOfWeek) ?? now
                return (startOfWeek, endOfWeek)
                
            case .thisMonth:
                let startOfMonth = calendar.dateInterval(of: .month, for: now)?.start ?? now
                let endOfMonth = calendar.dateInterval(of: .month, for: now)?.end ?? now
                return (startOfMonth, endOfMonth)
                
            case .lastMonth:
                let lastMonth = calendar.date(byAdding: .month, value: -1, to: now) ?? now
                let startOfLastMonth = calendar.dateInterval(of: .month, for: lastMonth)?.start ?? now
                let endOfLastMonth = calendar.dateInterval(of: .month, for: lastMonth)?.end ?? now
                return (startOfLastMonth, endOfLastMonth)
                
            case .custom:
                return (now, now)
            }
        }
    }
    
    init() {
        loadAnalytics()
    }
    
    func loadAnalytics() {
        let (startDate, endDate) = dateRange.getDateRange()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        
        let startString = formatter.string(from: startDate)
        let endString = formatter.string(from: endDate)
        
        isLoading = true
        errorMessage = nil
        
        let summaryPublisher = apiService.getAnalyticsSummary(
            start: startString,
            end: endString,
            includeAll: includeAll
        )
        
        let employeePublisher = apiService.getAnalyticsByEmployee(
            start: startString,
            end: endString,
            includeAll: includeAll
        )
        
        Publishers.CombineLatest(summaryPublisher, employeePublisher)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { [weak self] summary, employees in
                    self?.summary = summary
                    self?.employeeAnalytics = employees
                }
            )
            .store(in: &cancellables)
    }
    
    func refreshAnalytics() {
        loadAnalytics()
    }
    
    func clearError() {
        errorMessage = nil
    }
    
    func getTotalEntries() -> Int {
        guard let summary = summary else { return 0 }
        return summary.total_empty + summary.total_entered + summary.total_not_entered + summary.total_incorrect
    }
    
    func getCompletionPercentage() -> Double {
        guard let summary = summary else { return 0.0 }
        let total = getTotalEntries()
        guard total > 0 else { return 0.0 }
        return Double(summary.total_entered) / Double(total) * 100
    }
    
    func getStatusCounts() -> [(status: String, count: Int, color: String)] {
        guard let summary = summary else { return [] }
        
        return [
            ("Entered", summary.total_entered, "green"),
            ("Not Entered", summary.total_not_entered, "red"),
            ("Incorrect", summary.total_incorrect, "orange"),
            ("Empty", summary.total_empty, "gray")
        ]
    }
}