import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok', 
    hasBcrypt: !!bcrypt, 
    hasJwt: !!jwt 
  });
}
