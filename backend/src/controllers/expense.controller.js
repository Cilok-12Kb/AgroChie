import { addExpense, listExpenses, deleteExpense, expenseSummary } from "../services/expense.service.js";
import { parseExpenseCreate } from "../validators/expense.validator.js";

// [REVISI] 18.8
export async function create(req, res) {
  res.status(201).json(await addExpense(req.userId, req.params.id, parseExpenseCreate(req.body)));
}
export async function list(req, res) {
  res.json(await listExpenses(req.userId, req.params.id));
}
export async function remove(req, res) {
  res.json(await deleteExpense(req.userId, req.params.id, req.params.expenseId));
}
export async function summary(req, res) {
  res.json(await expenseSummary(req.userId, req.params.id));
}
