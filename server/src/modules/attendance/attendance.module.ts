import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { Break } from '../../entities/break.entity';
import { User } from '../../entities/user.entity';
import { AttendanceService } from './attendance.service';
import { GeofenceService } from './geofence.service';
import { AttendanceController } from './attendance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, Break, User]),
    AuthModule,
  ],
  providers: [AttendanceService, GeofenceService],
  controllers: [AttendanceController],
  exports: [AttendanceService],
})
export class AttendanceModule {}
