const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  
  // Check for token in headers or query parameters (for ease of download endpoints)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'intellicare_super_secret_key_2026_jwt_token_auth');
    
    // Attach user to request
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found in system' });
    }
    next();
  } catch (err) {
    console.error(`[Auth Middleware] JWT Error: ${err.message}`);
    return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' });
  }
};

// Role-based Access Control (RBAC) verification
const checkRole = (permittedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, login required' });
    }
    
    if (permittedRoles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource` 
      });
    }
  };
};

module.exports = { protect, checkRole };
