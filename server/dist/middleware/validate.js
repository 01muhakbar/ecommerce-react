const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    }
    catch (e) {
        const errors = e.errors.map((error) => ({
            path: error.path.join("."),
            message: error.message,
        }));
        return res.status(400).json({ status: "fail", errors });
    }
};
export default validate;
