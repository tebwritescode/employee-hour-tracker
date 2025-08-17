import SwiftUI

struct EmployeeListView: View {
    @StateObject private var viewModel = EmployeeViewModel()
    @EnvironmentObject private var apiService: APIService
    
    var body: some View {
        NavigationView {
            VStack {
                if viewModel.isLoading && viewModel.employees.isEmpty {
                    ProgressView("Loading employees...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.employees.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "person.2")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        
                        Text("No Employees")
                            .font(.title2)
                            .fontWeight(.medium)
                        
                        Text("Add your first employee to get started")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Button("Add Employee") {
                            viewModel.showingAddEmployee = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(viewModel.employees) { employee in
                            EmployeeRow(
                                employee: employee,
                                onEdit: { viewModel.startEditingEmployee(employee) },
                                onDelete: { viewModel.deleteEmployee(employee) }
                            )
                        }
                    }
                    .refreshable {
                        viewModel.loadEmployees()
                    }
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
            .navigationTitle("Employees")
            .navigationBarItems(trailing: Button("Add") {
                viewModel.showingAddEmployee = true
            })
        }
        .sheet(isPresented: $viewModel.showingAddEmployee) {
            AddEmployeeView(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showingEditEmployee) {
            EditEmployeeView(viewModel: viewModel)
        }
        .onAppear {
            if viewModel.employees.isEmpty {
                viewModel.loadEmployees()
            }
        }
    }
}

struct EmployeeRow: View {
    let employee: Employee
    let onEdit: () -> Void
    let onDelete: () -> Void
    @State private var showingDeleteAlert = false
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(employee.name)
                    .font(.headline)
                
                Text("Added: \(formatDate(employee.created_at))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Menu {
                Button("Edit", action: onEdit)
                Button("Delete", role: .destructive) {
                    showingDeleteAlert = true
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title2)
                    .foregroundColor(.gray)
            }
        }
        .padding(.vertical, 4)
        .alert("Delete Employee", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive, action: onDelete)
        } message: {
            Text("Are you sure you want to delete \(employee.name)? This will also delete all their time entries.")
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        
        if let date = formatter.date(from: dateString) {
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
        return dateString
    }
}

struct AddEmployeeView: View {
    @ObservedObject var viewModel: EmployeeViewModel
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Employee Name")
                        .font(.headline)
                    
                    TextField("Enter employee name", text: $viewModel.newEmployeeName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onSubmit {
                            if !viewModel.newEmployeeName.isEmpty {
                                viewModel.addEmployee()
                            }
                        }
                }
                
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Add Employee")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    viewModel.cancelAddEmployee()
                    presentationMode.wrappedValue.dismiss()
                },
                trailing: Button("Add") {
                    viewModel.addEmployee()
                    if viewModel.errorMessage == nil {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                .disabled(viewModel.newEmployeeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            )
        }
    }
}

struct EditEmployeeView: View {
    @ObservedObject var viewModel: EmployeeViewModel
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Employee Name")
                        .font(.headline)
                    
                    TextField("Enter employee name", text: $viewModel.editEmployeeName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onSubmit {
                            if !viewModel.editEmployeeName.isEmpty {
                                viewModel.updateEmployee()
                            }
                        }
                }
                
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Edit Employee")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    viewModel.cancelEditEmployee()
                    presentationMode.wrappedValue.dismiss()
                },
                trailing: Button("Save") {
                    viewModel.updateEmployee()
                    if viewModel.errorMessage == nil {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                .disabled(viewModel.editEmployeeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            )
        }
    }
}

#Preview {
    EmployeeListView()
        .environmentObject(APIService.shared)
}