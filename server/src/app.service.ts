import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  getHello(): string {
    return 'RedFort HRMS API is running!';
  }

  async onApplicationBootstrap() {
    try {
      const count = await this.userRepository.count();
      if (count === 0) {
        const passwordHash = await bcrypt.hash('adminpassword', 10);
        const admin = this.userRepository.create({
          email: 'admin@redfort.com',
          passwordHash,
          fullName: 'System Admin',
          role: UserRole.SUPER_ADMIN,
          department: 'Administration',
        });
        await this.userRepository.save(admin);
        console.log('--> Seeded default Admin user: admin@redfort.com / adminpassword');
      }
    } catch (err) {
      console.error('--> Error occurred during database seeding:', err.message);
    }
  }
}
