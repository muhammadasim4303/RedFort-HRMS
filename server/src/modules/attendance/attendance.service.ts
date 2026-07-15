import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { Break } from '../../entities/break.entity';
import { User } from '../../entities/user.entity';
import { GeofenceService } from './geofence.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Break)
    private readonly breakRepository: Repository<Break>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly geofenceService: GeofenceService,
  ) {}

  async checkIn(userId: string, latitude: number, longitude: number, isOnsite: boolean) {
    const active = await this.attendanceRepository.findOne({
      where: { employeeId: userId, checkOutTime: IsNull() },
    });
    if (active) {
      throw new BadRequestException({
        errorCode: 'ERR_ATT_SHIFT_ALREADY_ACTIVE',
        message: 'An active work shift is already recorded for this user identity.',
      });
    }

    if (isOnsite) {
      const employee = await this.userRepository.findOne({
        where: { id: userId },
        relations: { assignedLocation: true },
      });

      if (!employee) {
        throw new NotFoundException('Employee profile not found.');
      }

      if (!employee.assignedLocation) {
        throw new BadRequestException({
          errorCode: 'ERR_ATT_NO_ASSIGNED_LOCATION',
          message: 'You are not assigned to any onsite location. Please contact your manager.',
        });
      }

      const location = employee.assignedLocation;
      const distance = this.geofenceService.calculateDistanceInMeters(
        latitude,
        longitude,
        location.latitude,
        location.longitude,
      );

      if (distance > location.radiusInMeters) {
        throw new BadRequestException({
          errorCode: 'ERR_ATT_OUTSIDE_GEOFENCE',
          message: `You are outside the geofenced area. Distance from premises: ${distance.toFixed(1)} meters. Required radius: ${location.radiusInMeters} meters.`,
        });
      }
    }

    const attendance = this.attendanceRepository.create({
      employeeId: userId,
      checkInTime: new Date(),
      isOnsite,
      checkInLatitude: latitude,
      checkInLongitude: longitude,
    });

    return this.attendanceRepository.save(attendance);
  }

  async checkOut(userId: string, latitude: number, longitude: number) {
    const active = await this.attendanceRepository.findOne({
      where: { employeeId: userId, checkOutTime: IsNull() },
    });

    if (!active) {
      throw new BadRequestException({
        errorCode: 'ERR_ATT_NO_ACTIVE_SHIFT',
        message: 'No active work shift was found for your session.',
      });
    }

    active.checkOutTime = new Date();
    active.checkOutLatitude = latitude;
    active.checkOutLongitude = longitude;

    return this.attendanceRepository.save(active);
  }

  async startBreak(userId: string, breakType: string) {
    const activeAttendance = await this.attendanceRepository.findOne({
      where: { employeeId: userId, checkOutTime: IsNull() },
      relations: { breaks: true },
    });

    if (!activeAttendance) {
      throw new BadRequestException('You must be checked in to start a break.');
    }

    const activeBreak = activeAttendance.breaks?.find((b) => !b.endTime);
    if (activeBreak) {
      throw new BadRequestException('You already have an active break running.');
    }

    const newBreak = this.breakRepository.create({
      attendanceId: activeAttendance.id,
      startTime: new Date(),
      breakType,
    });

    return this.breakRepository.save(newBreak);
  }

  async endBreak(userId: string) {
    const activeAttendance = await this.attendanceRepository.findOne({
      where: { employeeId: userId, checkOutTime: IsNull() },
      relations: { breaks: true },
    });

    if (!activeAttendance) {
      throw new BadRequestException('You must be checked in to end a break.');
    }

    const activeBreak = activeAttendance.breaks?.find((b) => !b.endTime);
    if (!activeBreak) {
      throw new BadRequestException('No active break was found to end.');
    }

    activeBreak.endTime = new Date();
    return this.breakRepository.save(activeBreak);
  }

  async getStatus(userId: string) {
    const activeAttendance = await this.attendanceRepository.findOne({
      where: { employeeId: userId, checkOutTime: IsNull() },
      relations: { breaks: true },
    });

    return {
      isCheckedIn: !!activeAttendance,
      activeAttendance,
    };
  }

  async getHistory(userId: string) {
    return this.attendanceRepository.find({
      where: { employeeId: userId },
      order: { checkInTime: 'DESC' },
      relations: { breaks: true },
    });
  }
}
