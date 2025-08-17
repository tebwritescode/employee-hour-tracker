import SwiftUI

struct AnalyticsView: View {
    @StateObject private var viewModel = AnalyticsViewModel()
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Date Range Picker
                    DateRangePicker(viewModel: viewModel)
                    
                    if viewModel.isLoading {
                        ProgressView("Loading analytics...")
                            .frame(maxWidth: .infinity, minHeight: 100)
                    } else if let summary = viewModel.summary {
                        // Summary Cards
                        SummaryCardsView(summary: summary, totalEntries: viewModel.getTotalEntries())
                        
                        // Completion Chart
                        CompletionChartView(
                            completionPercentage: viewModel.getCompletionPercentage(),
                            statusCounts: viewModel.getStatusCounts()
                        )
                        
                        // Employee Analytics List
                        EmployeeAnalyticsList(employees: viewModel.employeeAnalytics)
                    } else {
                        VStack(spacing: 16) {
                            Image(systemName: "chart.bar")
                                .font(.system(size: 48))
                                .foregroundColor(.gray)
                            
                            Text("No Data Available")
                                .font(.title2)
                                .fontWeight(.medium)
                            
                            Text("Select a date range to view analytics")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: 200)
                    }
                    
                    if let errorMessage = viewModel.errorMessage {
                        VStack {
                            Text(errorMessage)
                                .foregroundColor(.red)
                                .font(.caption)
                                .padding()
                            
                            Button("Retry") {
                                viewModel.refreshAnalytics()
                            }
                            .font(.caption)
                            .foregroundColor(.blue)
                        }
                        .background(Color(.systemBackground))
                        .cornerRadius(8)
                        .padding()
                    }
                }
                .padding()
            }
            .navigationTitle("Analytics")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                viewModel.refreshAnalytics()
            }
        }
        .onAppear {
            if viewModel.summary == nil {
                viewModel.refreshAnalytics()
            }
        }
    }
}

struct DateRangePicker: View {
    @ObservedObject var viewModel: AnalyticsViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Date Range")
                .font(.headline)
            
            HStack {
                Picker("Date Range", selection: $viewModel.dateRange) {
                    ForEach(AnalyticsViewModel.DateRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .onChange(of: viewModel.dateRange) { _ in
                    viewModel.refreshAnalytics()
                }
                
                Button(action: viewModel.refreshAnalytics) {
                    Image(systemName: "arrow.clockwise")
                        .font(.title3)
                }
            }
            
            Toggle("Include employees with no entries", isOn: $viewModel.includeAll)
                .onChange(of: viewModel.includeAll) { _ in
                    viewModel.refreshAnalytics()
                }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct SummaryCardsView: View {
    let summary: AnalyticsSummary
    let totalEntries: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Overview")
                .font(.headline)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                SummaryCard(
                    title: "Total Employees",
                    value: "\(summary.total_employees)",
                    color: .blue
                )
                
                SummaryCard(
                    title: "Total Weeks",
                    value: "\(summary.total_weeks)",
                    color: .purple
                )
                
                SummaryCard(
                    title: "Total Entries",
                    value: "\(totalEntries)",
                    color: .orange
                )
                
                SummaryCard(
                    title: "Completion Rate",
                    value: String(format: "%.1f%%", Double(summary.total_entered) / Double(max(totalEntries, 1)) * 100),
                    color: .green
                )
            }
        }
    }
}

struct SummaryCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

struct CompletionChartView: View {
    let completionPercentage: Double
    let statusCounts: [(status: String, count: Int, color: String)]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Time Entry Status")
                .font(.headline)
            
            // Circular Progress View
            HStack {
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.3), lineWidth: 8)
                        .frame(width: 100, height: 100)
                    
                    Circle()
                        .trim(from: 0, to: completionPercentage / 100)
                        .stroke(Color.green, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .frame(width: 100, height: 100)
                        .rotationEffect(.degrees(-90))
                    
                    VStack {
                        Text("\(Int(completionPercentage))%")
                            .font(.title3)
                            .fontWeight(.bold)
                        Text("Complete")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(statusCounts, id: \.status) { item in
                        StatusLegendItem(
                            status: item.status,
                            count: item.count,
                            color: colorFromString(item.color)
                        )
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    private func colorFromString(_ colorString: String) -> Color {
        switch colorString {
        case "green": return .green
        case "red": return .red
        case "orange": return .orange
        case "gray": return .gray
        default: return .primary
        }
    }
}

struct StatusLegendItem: View {
    let status: String
    let count: Int
    let color: Color
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 12, height: 12)
            
            Text(status)
                .font(.caption)
                .foregroundColor(.primary)
            
            Spacer()
            
            Text("\(count)")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
        }
    }
}

struct EmployeeAnalyticsList: View {
    let employees: [EmployeeAnalytics]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Employee Details")
                .font(.headline)
            
            if employees.isEmpty {
                Text("No employee data available for selected period")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical)
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(employees) { employee in
                        EmployeeAnalyticsCard(employee: employee)
                    }
                }
            }
        }
    }
}

struct EmployeeAnalyticsCard: View {
    let employee: EmployeeAnalytics
    
    private var totalEntries: Int {
        employee.total_empty + employee.total_entered + employee.total_not_entered + employee.total_incorrect
    }
    
    private var completionRate: Double {
        guard totalEntries > 0 else { return 0 }
        return Double(employee.total_entered) / Double(totalEntries) * 100
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(employee.name)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text("\(Int(completionRate))%")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.green)
            }
            
            HStack(spacing: 16) {
                StatusCount(label: "Entered", count: employee.total_entered, color: .green)
                StatusCount(label: "Missing", count: employee.total_not_entered, color: .red)
                StatusCount(label: "Incorrect", count: employee.total_incorrect, color: .orange)
                StatusCount(label: "Empty", count: employee.total_empty, color: .gray)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

struct StatusCount: View {
    let label: String
    let count: Int
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text("\(count)")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    AnalyticsView()
}