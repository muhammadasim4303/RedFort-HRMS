import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../../entities/user.entity';
import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password;
}

class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  role: any;

  @IsNotEmpty()
  @IsString()
  department: string;

  @IsOptional()
  managerId?: string;
}

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user and issue JWT' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new employee/intern (SuperAdmin only)' })
  async register(@Body() body: RegisterDto) {
    let mappedRole = body.role;
    if (mappedRole === 0 || mappedRole === '0') mappedRole = UserRole.SUPER_ADMIN;
    else if (mappedRole === 1 || mappedRole === '1') mappedRole = UserRole.LINE_MANAGER;
    else if (mappedRole === 2 || mappedRole === '2') mappedRole = UserRole.EMPLOYEE;
    else if (mappedRole === 3 || mappedRole === '3') mappedRole = UserRole.INTERN;

    return this.authService.register({
      email: body.email,
      fullName: body.fullName,
      pass: body.password,
      role: mappedRole,
      department: body.department,
      managerId: body.managerId,
    });
  }
}
