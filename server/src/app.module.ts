import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { User } from './entities/user.entity';
import { Location } from './entities/location.entity';
import { Attendance } from './entities/attendance.entity';
import { Break } from './entities/break.entity';
import { TaskItem } from './entities/task-item.entity';
import { Blocker } from './entities/blocker.entity';
import { Leave } from './entities/leave.entity';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { LocationsModule } from './modules/locations/locations.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { LeaveModule } from './modules/leaves/leave.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HubsModule } from './hubs/hubs.module';

@Module({
  imports: [
    // Load .env from root workspace folder
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    
    // Configure Database Connection dynamically
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: parseInt(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'redfort_hrms'),
        entities: [User, Location, Attendance, Break, TaskItem, Blocker, Leave],
        synchronize: true, // auto-create/update schemas on startup in dev
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([User]),

    // Application Modules
    AuthModule,
    LocationsModule,
    AttendanceModule,
    TasksModule,
    LeaveModule,
    EmployeesModule,
    HubsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
