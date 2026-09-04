import Employee from "../models/employeeModel.js";

// ✅ Create Employee
export const createEmployee = async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Employees
export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Single Employee
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee)
      return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update Employee
export const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!employee)
      return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete Employee
export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee)
      return res.status(404).json({ message: "Employee not found" });
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Bulk Create Employees (import)
export const createBulkEmployees = async (req, res) => {
  try {
    const employeesData = Array.isArray(req.body) ? req.body : req.body?.employees ?? [];
    const ROLES = ["salesman", "cashier", "manager", "admin"];
    const STATUSES = ["active", "inactive"];
    let createdCount = 0;
    let errorCount = 0;
    const created = [];

    for (const data of employeesData) {
      try {
        const payload = {
          name: data.name ?? data.Name ?? "",
          phone: String(data.phone ?? data.Phone ?? ""),
          email: String(data.email ?? data.Email ?? ""),
          role: ROLES.includes(data.role ?? data.Role) ? (data.role ?? data.Role) : "salesman",
          salary: Number(data.salary ?? data.Salary ?? 0) || 0,
          status: STATUSES.includes(data.status ?? data.Status) ? (data.status ?? data.Status) : "active",
        };
        const employee = await Employee.create(payload);
        created.push(employee);
        createdCount++;
      } catch {
        errorCount++;
      }
    }

    res.status(200).json({
      success: true,
      createdCount,
      errorCount,
      message: `${createdCount} employees created${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      employees: created,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create employees in bulk",
      error: error.message,
    });
  }
};
