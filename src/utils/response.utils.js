/**
 * Standard API Response Structure
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Success/Error message
 * @param {Object|Array|null} data - Response payload
 * @param {Object|null} error - Detail error object (for development)
 */
const sendResponse = (res, statusCode, message, data = null, error = null) => {
    const success = statusCode >= 200 && statusCode < 300;

    return res.status(statusCode).json({
        success,
        message,
        data,
        ...(error && { error })
    });
};

module.exports = { sendResponse };
