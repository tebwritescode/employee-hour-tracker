import Foundation

struct Employee: Identifiable, Codable {
    let id: Int
    let name: String
    let created_at: String
}

struct TimeEntry: Identifiable, Codable {
    let id: Int
    let employee_id: Int
    let name: String
    let week_start: String
    let monday: String
    let tuesday: String
    let wednesday: String
    let thursday: String
    let friday: String
    let saturday: String
    let sunday: String
}

enum TimeStatus: String, CaseIterable, Codable {
    case empty = "Empty"
    case notEntered = "Not Entered"
    case entered = "Entered"
    case incorrect = "Incorrect"
    
    var color: String {
        switch self {
        case .empty:
            return "gray"
        case .notEntered:
            return "red"
        case .entered:
            return "green"
        case .incorrect:
            return "orange"
        }
    }
    
    var systemImageName: String {
        switch self {
        case .empty:
            return "minus.circle"
        case .notEntered:
            return "xmark.circle"
        case .entered:
            return "checkmark.circle"
        case .incorrect:
            return "exclamationmark.circle"
        }
    }
}

struct LoginRequest: Codable {
    let username: String
    let password: String
}

struct LoginResponse: Codable {
    let success: Bool
}

struct AuthCheckResponse: Codable {
    let authenticated: Bool
}

struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let message: String?
    let data: T?
}

struct AnalyticsSummary: Codable {
    let total_employees: Int
    let total_weeks: Int
    let total_empty: Int
    let total_entered: Int
    let total_not_entered: Int
    let total_incorrect: Int
}

struct EmployeeAnalytics: Codable, Identifiable {
    let employee_id: Int
    let name: String
    let total_empty: Int
    let total_entered: Int
    let total_not_entered: Int
    let total_incorrect: Int
    
    var id: Int { employee_id }
}

struct TimeEntryUpdate: Codable {
    let employeeId: Int
    let weekStart: String
    let day: String
    let status: String
}

struct AddEmployeeRequest: Codable {
    let name: String
}

struct UpdateEmployeeRequest: Codable {
    let name: String
}

struct ConfigResponse: Codable {
    let baseUrl: String?
}

struct VersionResponse: Codable {
    let version: String
    let sessionVersion: String?
    let needsRefresh: Bool
}

extension TimeEntry {
    func statusForDay(_ day: String) -> TimeStatus {
        let statusString: String
        switch day.lowercased() {
        case "monday":
            statusString = monday
        case "tuesday":
            statusString = tuesday
        case "wednesday":
            statusString = wednesday
        case "thursday":
            statusString = thursday
        case "friday":
            statusString = friday
        case "saturday":
            statusString = saturday
        case "sunday":
            statusString = sunday
        default:
            statusString = "Empty"
        }
        return TimeStatus(rawValue: statusString) ?? .empty
    }
}

extension Date {
    func mondayOfWeek() -> Date {
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: self)
        let daysToSubtract = (weekday == 1) ? 6 : weekday - 2
        return calendar.date(byAdding: .day, value: -daysToSubtract, to: self) ?? self
    }
    
    func formatAsWeekStart() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}