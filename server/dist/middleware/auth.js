export const isAuth = (req, res, next) => {
    // This is a dummy implementation to resolve the import in api.ts
    console.log("isAuth middleware called");
    next();
};
