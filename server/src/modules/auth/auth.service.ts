import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: { assignedLocation: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        managerId: true,
        assignedLocationId: true,
        passwordHash: true, // explicitly select passwordHash
      },
    });

    if (!user || !user.passwordHash || !(await bcrypt.compare(pass, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      fullName: user.fullName,
      department: user.department,
    };

    const token = this.jwtService.sign(payload);
    
    // Cast to any to delete the passwordHash safely
    delete (user as any).passwordHash;

    return {
      token,
      user,
    };
  }

  async register(userData: {
    email: string;
    fullName: string;
    pass: string;
    role: UserRole;
    department: string;
    managerId?: string;
  }) {
    const existing = await this.userRepository.findOne({
      where: { email: userData.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered.');
    }

    if (userData.managerId) {
      const manager = await this.userRepository.findOne({
        where: { id: userData.managerId },
      });
      if (!manager || (manager.role !== UserRole.LINE_MANAGER && manager.role !== UserRole.SUPER_ADMIN)) {
        throw new BadRequestException(
          'Invalid Manager ID. Selected manager must exist and have Manager or Admin role.',
        );
      }
    }

    const passwordHash = await bcrypt.hash(userData.pass, 10);
    const user = this.userRepository.create({
      email: userData.email.toLowerCase(),
      passwordHash,
      fullName: userData.fullName,
      role: userData.role,
      department: userData.department,
      managerId: userData.managerId || null,
    });

    await this.userRepository.save(user);
    return { message: 'User registered successfully.', userId: user.id };
  }
}
