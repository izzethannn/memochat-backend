# Security Policy

## 🔒 Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.1.x   | :white_check_mark: |
| 2.0.x   | :x:                |
| < 2.0   | :x:                |

## 🚨 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them responsibly by:

### Email
Send details to: **[Your email - update this]**

### What to Include

Please include the following information:

- **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass)
- **Full paths** of source file(s) related to the vulnerability
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the vulnerability and how an attacker might exploit it
- **Suggested fix** (if you have one)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Best effort

## 🛡️ Security Best Practices

When deploying MemoChat:

### Environment Configuration
- ✅ Use strong JWT secrets (32+ characters, random)
- ✅ Change default credentials
- ✅ Use HTTPS in production
- ✅ Set secure environment variables
- ✅ Never commit `.env` files

### Network Security
- ✅ Enable rate limiting
- ✅ Use firewall rules
- ✅ Implement CORS properly
- ✅ Use secure WebSocket connections (WSS)
- ✅ Keep dependencies updated

### Authentication
- ✅ Enforce strong password requirements
- ✅ Implement CAPTCHA protection
- ✅ Use bcrypt for password hashing
- ✅ Rotate JWT secrets periodically
- ✅ Implement session timeouts

### Monitoring
- ✅ Enable logging
- ✅ Monitor for suspicious activity
- ✅ Set up alerts for security events
- ✅ Regular security audits
- ✅ Keep audit logs

## 🔐 Known Security Considerations

### WebRTC
- Peer-to-peer connections expose IP addresses
- Use TURN servers to hide IPs if needed
- Implement proper signaling server security

### User Input
- All user input is sanitized
- CAPTCHA prevents automated attacks
- Rate limiting prevents spam
- Username validation prevents injection

### Dependencies
- Dependabot enabled for automatic updates
- Regular security audits with `npm audit`
- Only use trusted packages

## 📋 Security Checklist for Deployment

- [ ] Changed JWT_SECRET to a strong random value
- [ ] Configured HTTPS/SSL certificates
- [ ] Set up firewall rules
- [ ] Enabled rate limiting
- [ ] Configured CORS properly
- [ ] Set secure cookie flags
- [ ] Enabled security headers
- [ ] Configured logging and monitoring
- [ ] Set up backup systems
- [ ] Reviewed and hardened server configuration

## 🔄 Security Updates

We will:
- Publish security advisories for confirmed vulnerabilities
- Release patches as soon as possible
- Credit researchers (if desired)
- Maintain transparency about security issues

## 📞 Contact

For security concerns:
- **Email**: [Your email - update this]
- **GPG Key**: [Optional - add if you have one]

For general questions:
- **GitHub Issues**: For non-security bugs
- **GitHub Discussions**: For questions and ideas

## 🙏 Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help us improve MemoChat's security.

---

**Note**: This security policy is subject to change. Please check back regularly for updates.
