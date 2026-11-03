import { Module } from '@nestjs/common';
import { AuthController, MeController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CleanupService } from './cleanup.service.js';
import { MailService } from './mail.service.js';
import { RateLimiter } from './rate-limit.js';
import { AdminGuard, SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, MailService, RateLimiter, SessionGuard, AdminGuard, CleanupService],
  exports: [AuthService, SessionGuard, AdminGuard, RateLimiter, MailService],
})
export class AuthModule {}
