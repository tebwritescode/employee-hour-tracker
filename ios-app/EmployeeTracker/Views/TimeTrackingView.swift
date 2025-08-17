import SwiftUI

struct TimeTrackingView: View {
    @StateObject private var viewModel = TimeTrackingViewModel()
    @EnvironmentObject private var apiService: APIService
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                WeekNavigationView(viewModel: viewModel)
                
                if viewModel.isLoading && viewModel.employees.isEmpty {
                    ProgressView("Loading...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.employees.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "person.2")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        
                        Text("No Employees")
                            .font(.title2)
                            .fontWeight(.medium)
                        
                        Text("Add employees to start tracking time")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    TimeTrackingGrid(viewModel: viewModel)
                }
                
                if let errorMessage = viewModel.errorMessage {
                    VStack {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                            .padding()
                        
                        Button("Dismiss") {
                            viewModel.clearError()
                        }
                        .font(.caption)
                        .foregroundColor(.blue)
                    }
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
                    .padding()
                }
            }
            .navigationTitle("Time Tracking")
            .navigationBarTitleDisplayMode(.large)
        }
        .onAppear {
            viewModel.loadData()
        }
        .refreshable {
            viewModel.loadData()
        }
    }
}

struct WeekNavigationView: View {
    @ObservedObject var viewModel: TimeTrackingViewModel
    
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button(action: viewModel.previousWeek) {
                    Image(systemName: "chevron.left")
                        .font(.title2)
                }
                
                Spacer()
                
                VStack(spacing: 2) {
                    Text(viewModel.getWeekRange())
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Button("Today", action: viewModel.goToCurrentWeek)
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                
                Spacer()
                
                Button(action: viewModel.nextWeek) {
                    Image(systemName: "chevron.right")
                        .font(.title2)
                }
            }
            .padding(.horizontal)
            
            Divider()
        }
        .background(Color(.systemBackground))
    }
}

struct TimeTrackingGrid: View {
    @ObservedObject var viewModel: TimeTrackingViewModel
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                HeaderRow(weekdayNames: viewModel.getWeekdayNames())
                
                ForEach(viewModel.employees) { employee in
                    EmployeeTimeRow(
                        employee: employee,
                        weekdays: viewModel.getWeekdays(),
                        getStatus: { day in
                            viewModel.getStatus(for: employee.id, day: day)
                        },
                        updateStatus: { day, status in
                            viewModel.updateTimeEntry(employeeId: employee.id, day: day, status: status)
                        }
                    )
                    
                    Divider()
                }
            }
        }
    }
}

struct HeaderRow: View {
    let weekdayNames: [String]
    
    var body: some View {
        HStack(spacing: 0) {
            Text("Employee")
                .font(.caption)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
            
            ForEach(weekdayNames, id: \.self) { dayName in
                Text(dayName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
    }
}

struct EmployeeTimeRow: View {
    let employee: Employee
    let weekdays: [String]
    let getStatus: (String) -> TimeStatus
    let updateStatus: (String, TimeStatus) -> Void
    
    var body: some View {
        HStack(spacing: 0) {
            Text(employee.name)
                .font(.system(size: 14))
                .fontWeight(.medium)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            
            ForEach(weekdays, id: \.self) { day in
                TimeStatusButton(
                    status: getStatus(day),
                    onTap: {
                        let currentStatus = getStatus(day)
                        let nextStatus = nextTimeStatus(currentStatus)
                        updateStatus(day, nextStatus)
                    }
                )
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 8)
    }
    
    private func nextTimeStatus(_ current: TimeStatus) -> TimeStatus {
        switch current {
        case .empty:
            return .notEntered
        case .notEntered:
            return .entered
        case .entered:
            return .incorrect
        case .incorrect:
            return .empty
        }
    }
}

struct TimeStatusButton: View {
    let status: TimeStatus
    let onTap: () -> Void
    @EnvironmentObject private var apiService: APIService
    
    var body: some View {
        Button(action: apiService.isAuthenticated ? onTap : {}) {
            Image(systemName: status.systemImageName)
                .font(.title3)
                .foregroundColor(colorForStatus(status))
        }
        .frame(minHeight: 44)
        .disabled(!apiService.isAuthenticated)
    }
    
    private func colorForStatus(_ status: TimeStatus) -> Color {
        switch status {
        case .empty:
            return .gray
        case .notEntered:
            return .red
        case .entered:
            return .green
        case .incorrect:
            return .orange
        }
    }
}

#Preview {
    TimeTrackingView()
        .environmentObject(APIService.shared)
}