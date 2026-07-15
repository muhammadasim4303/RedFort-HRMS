import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../../entities/location.entity';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createLocation(
    name: string,
    latitude: number,
    longitude: number,
    radiusInMeters: number,
    managerId: string,
  ) {
    const location = this.locationRepository.create({
      name,
      latitude,
      longitude,
      radiusInMeters,
      createdById: managerId,
    });
    return this.locationRepository.save(location);
  }

  async getFavoriteLocations(userId: string, role: UserRole) {
    if (role === UserRole.LINE_MANAGER || role === UserRole.SUPER_ADMIN) {
      return this.locationRepository.find({
        where: { createdById: userId },
      });
    } else {
      // Employee: find locations created by their manager (if they have one)
      const employee = await this.userRepository.findOne({ where: { id: userId } });
      if (employee && employee.managerId) {
        return this.locationRepository.find({
          where: { createdById: employee.managerId },
        });
      }
      // Or return all
      return this.locationRepository.find();
    }
  }

  async assignLocation(employeeId: string, locationId: string | null, managerId: string, role: UserRole) {
    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    if (role === UserRole.LINE_MANAGER) {
      if (employee.managerId !== managerId) {
        throw new ForbiddenException('You cannot assign locations to employees you do not manage.');
      }
    }

    if (locationId) {
      const location = await this.locationRepository.findOne({ where: { id: locationId } });
      if (!location) {
        throw new NotFoundException('Location not found.');
      }
      employee.assignedLocationId = locationId;
    } else {
      employee.assignedLocationId = null;
    }

    await this.userRepository.save(employee);
    return {
      message: 'Location assigned to employee successfully.',
      employeeId: employee.id,
      assignedLocationId: employee.assignedLocationId,
    };
  }
}
