// Filter products by category and search term
export const filterProducts = (products, category, searchTerm = "") => {
  const mainCategories = ["COFFEE", "FRAPPE", "MILK TEA", "PASTRIES", "PASTRY", "PROMO"];
  
  return products.filter(p => {
    const pCat = (p.category || "").toUpperCase();
    const targetCat = category.toUpperCase();
    
    let matchCategory = false;
    if (targetCat === "ALL") {
      matchCategory = true;
    } else if (targetCat === "OTHERS") {
      // Items that are not in the main categories list go to 'OTHERS'
      matchCategory = !mainCategories.includes(pCat);
    } else if (targetCat === "PASTRIES") {
      // Match both 'PASTRIES' and 'PASTRY'
      matchCategory = (pCat === "PASTRIES" || pCat === "PASTRY");
    } else {
      matchCategory = pCat === targetCat;
    }

    const matchSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });
};
