// Get current user from localStorage
export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

// Check if user is authorized to access POS
export const isAuthorized = (user) => {
  return user && ["ADMIN", "STAFF", "Owner", "Admin", "Staff"].includes(user.role);
};
