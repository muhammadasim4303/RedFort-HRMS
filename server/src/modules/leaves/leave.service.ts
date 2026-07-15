import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave, LeaveStatus } from '../../entities/leave.entity';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async applyLeave(userId: string, leaveType: string, startDate: Date, endDate: Date) {
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before or equal to end date.');
    }

    const leave = this.leaveRepository.create({
      employeeId: userId,
      leaveType,
      startDate,
      endDate,
      status: LeaveStatus.PENDING,
    });
    return this.leaveRepository.save(leave);
  }

  async getLeaves(userId: string, role: UserRole) {
    if (role === UserRole.LINE_MANAGER || role === UserRole.SUPER_ADMIN) {
      // Find leaves of managed employees
      const query = this.leaveRepository
        .createQueryBuilder('leave')
        .innerJoinAndSelect('leave.employee', 'employee');

      if (role === UserRole.LINE_MANAGER) {
        query.where('employee.managerId = :managerId', { managerId: userId });
      }

      const list = await query.orderBy('leave.startDate', 'DESC').getMany();
      
      return list.map((l) => ({
        id: l.id,
        employeeId: l.employeeId,
        employeeName: l.employee?.fullName || 'Unknown',
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
        managerReason: l.managerReason,
      }));
    } else {
      // Employee: list self leaves
      return this.leaveRepository.find({
        where: { employeeId: userId },
        order: { startDate: 'DESC' },
      });
    }
  }

  async processLeave(leaveId: string, status: LeaveStatus, managerReason: string | null, managerId: string, role: UserRole) {
    if (status === LeaveStatus.PENDING) {
      throw new BadRequestException('Status cannot be updated back to Pending.');
    }

    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId },
      relations: { employee: true },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found.');
    }

    if (role === UserRole.LINE_MANAGER) {
      if (leave.employee?.managerId !== managerId) {
        throw new ForbiddenException('You can only approve/reject leaves for your managed employees.');
      }
    }

    leave.status = status;
    leave.managerReason = managerReason;

    await this.leaveRepository.save(leave);
    return leave;
  }
}
