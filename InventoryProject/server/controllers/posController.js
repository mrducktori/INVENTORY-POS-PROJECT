import * as posService from "../services/posService.js";

export const getProducts = async (req, res) => {
  try {
    const data = await posService.getProducts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createSale = async (req, res) => {
  try {
    const sale = await posService.createSale(req.body);
    res.json({ message: "Sale completed", sale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
