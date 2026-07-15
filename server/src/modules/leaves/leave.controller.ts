import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { LeaveStatus } from '../../entities/leave.entity';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class ApplyLeaveDto {
  @IsNotEmpty()
  @IsString()
  leaveType: string;

  @IsNotEmpty()
  @IsString()
  startDate: string;

  @IsNotEmpty()
  @IsString()
  endDate: string;
}

class ProcessLeaveDto {
  @IsNotEmpty()
  status: any;

  @IsOptional()
  @IsString()
  managerReason?: string;
}

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/leaves')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @ApiOperation({ summary: 'Employee applies for leave' })
  async applyLeave(@Req() req: any, @Body() body: ApplyLeaveDto) {
    return this.leaveService.applyLeave(
      req.user.id,
      body.leaveType,
      new Date(body.startDate),
      new Date(body.endDate),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get leave requests list based on active user role' })
  async getLeaves(@Req() req: any) {
    return this.leaveService.getLeaves(req.user.id, req.user.role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manager processes a leave application (approve/reject)' })
  async processLeave(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: ProcessLeaveDto,
  ) {
    let mappedStatus = body.status;
    if (mappedStatus === 1 || mappedStatus === '1' || mappedStatus === 'Approved') {
      mappedStatus = LeaveStatus.APPROVED;
    } else if (mappedStatus === 2 || mappedStatus === '2' || mappedStatus === 'Rejected') {
      mappedStatus = LeaveStatus.REJECTED;
    } else if (mappedStatus === 0 || mappedStatus === '0' || mappedStatus === 'Pending') {
      mappedStatus = LeaveStatus.PENDING;
    }

    return this.leaveService.processLeave(
      id,
      mappedStatus,
      body.managerReason || null,
      req.user.id,
      req.user.role,
    );
  }
}
