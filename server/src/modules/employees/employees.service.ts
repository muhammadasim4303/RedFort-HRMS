import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { Attendance } from '../../entities/attendance.entity';
import { TaskItem } from '../../entities/task-item.entity';
import { Leave } from '../../entities/leave.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(TaskItem)
    private readonly taskRepository: Repository<TaskItem>,
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
  ) {}

  async getEmployees(userId: string, role: UserRole) {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.assignedLocation', 'location')
      .leftJoinAndSelect('user.attendances', 'attendance');

    if (role === UserRole.LINE_MANAGER) {
      query.where('user.managerId = :managerId', { managerId: userId });
    }

    const employees = await query.getMany();

    return employees.map((e) => {
      // Find active check-in
      const activeCheckIn = e.attendances?.find((a) => !a.checkOutTime);
      const sortedAttendances = e.attendances?.sort(
        (a, b) => b.checkInTime.getTime() - a.checkInTime.getTime(),
      );
      const lastLogin = sortedAttendances?.[0]?.checkInTime || null;
      // Find the most recent completed attendance (with checkout)
      const lastCompleted = sortedAttendances?.find((a) => !!a.checkOutTime);

      return {
        id: e.id,
        email: e.email,
        fullName: e.fullName,
        role: e.role,
        department: e.department,
        managerId: e.managerId,
        assignedLocationId: e.assignedLocationId,
        assignedLocation: e.assignedLocation
          ? {
              id: e.assignedLocation.id,
              name: e.assignedLocation.name,
              latitude: e.assignedLocation.latitude,
              longitude: e.assignedLocation.longitude,
              radiusInMeters: e.assignedLocation.radiusInMeters,
            }
          : null,
        activeAttendance: activeCheckIn
          ? {
              isCheckedIn: true,
              checkInTime: activeCheckIn.checkInTime,
              latitude: activeCheckIn.checkInLatitude,
              longitude: activeCheckIn.checkInLongitude,
              isOnsite: activeCheckIn.isOnsite,
            }
          : {
              isCheckedIn: false,
              checkInTime: null,
              latitude: 0.0,
              longitude: 0.0,
              isOnsite: false,
            },
        lastCheckOut: lastCompleted
          ? {
              checkInTime: lastCompleted.checkInTime,
              checkOutTime: lastCompleted.checkOutTime,
              isOnsite: lastCompleted.isOnsite,
            }
          : null,
        lastLogin,
      };
    });
  }

  async getEmployeeHistory(employeeId: string, managerId: string, role: UserRole) {
    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    if (role === UserRole.LINE_MANAGER && employee.managerId !== managerId) {
      throw new ForbiddenException('You cannot access history of employees you do not manage.');
    }

    const attendances = await this.attendanceRepository.find({
      where: { employeeId },
      order: { checkInTime: 'DESC' },
      relations: { breaks: true },
    });

    const tasks = await this.taskRepository.find({
      where: { assignedToId: employeeId },
      order: { deadline: 'DESC' },
      relations: { blockers: true },
    });

    const leaves = await this.leaveRepository.find({
      where: { employeeId },
      order: { startDate: 'DESC' },
    });

    return {
      employeeId,
      employeeName: employee.fullName,
      attendances,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        deadline: t.deadline,
        priority: t.priority,
        assignmentStatus: t.assignmentStatus,
        rejectionReason: t.rejectionReason,
        progressStatus: t.progressStatus,
        blockersCount: t.blockers?.length || 0,
      })),
      leaves,
    };
  }
}
