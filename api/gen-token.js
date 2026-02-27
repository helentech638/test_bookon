const jwt = require('jsonwebtoken');
const secret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.BookOn.JWT.Secret.2024.Secure.Key.For.Authentication.Purposes.Only.Use.In.Production.Environment.With.Strong.Encryption.And.Proper.Security.Measures';
const token = jwt.sign({ userId: 'test-user-id', email: 'test@example.com', role: 'business' }, secret, { expiresIn: '1h' });
console.log(token);
