import { register, login } from '../controllers/authController';
import { Request, Response } from 'express';
import { prismaMock } from './setup';
import bcrypt from 'bcryptjs';

describe('Auth Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
    };
  });

  describe('register', () => {
    it('should create a new user and return a token when OAB is provided', async () => {
      req = {
        body: {
          name: 'Test User',
          email: 'test@prazzo.com',
          password: 'password123',
          phone: '11999999999',
          oabNumber: '123456',
          oabState: 'SP'
        }
      };

      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        email: 'test@prazzo.com',
        password_hash: 'hashed_pw',
        phone: '11999999999',
        subscriptionTier: 'FREE',
        oabNumber: '123456',
        oabState: 'SP',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      await register(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        token: expect.any(String)
      }));
    });

    it('should return 400 if OAB is missing', async () => {
        req = {
          body: {
            name: 'Test User',
            email: 'test@prazzo.com',
            password: 'password123'
          }
        };
  
        await register(req as Request, res as Response);
  
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('OAB')
        }));
      });

    it('should return 400 if email already exists', async () => {
      req = {
        body: { 
            email: 'existing@prazzo.com',
            oabNumber: '123456',
            oabState: 'SP',
            name: 'Test',
            password: '123',
            phone: '123'
        }
      };

      prismaMock.user.findUnique.mockResolvedValue({ id: '1' } as any);

      await register(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'E-mail já cadastrado no Prazzo.' });
    });
  });

  describe('login', () => {
    it('should return 200 and token for valid credentials', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      req = {
        body: { email: 'test@prazzo.com', password }
      };

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@prazzo.com',
        password_hash: hashedPassword,
        subscriptionTier: 'FREE',
        name: 'Test User'
      } as any);

      await login(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        token: expect.any(String)
      }));
    });
  });
});
