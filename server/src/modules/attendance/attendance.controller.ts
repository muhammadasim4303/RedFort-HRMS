import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsNotEmpty, IsNumber, IsBoolean, IsString } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class CheckInDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsBoolean()
  isOnsite: boolean;
}

class CheckOutDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

class BreakDto {
  @IsNotEmpty()
  @IsString()
  breakType: string;
}

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Employee shift check-in with geofencing check' })
  async checkIn(@Req() req: any, @Body() body: CheckInDto) {
    return this.attendanceService.checkIn(
      req.user.id,
      body.latitude,
      body.longitude,
      body.isOnsite,
    );
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Employee shift check-out' })
  async checkOut(@Req() req: any, @Body() body: CheckOutDto) {
    return this.attendanceService.checkOut(
      req.user.id,
      body.latitude,
      body.longitude,
    );
  }

  @Post('break/start')
  @ApiOperation({ summary: 'Start a break (e.g. Lunch, Tea)' })
  async startBreak(@Req() req: any, @Body() body: BreakDto) {
    return this.attendanceService.startBreak(req.user.id, body.breakType);
  }

  @Post('break/end')
  @ApiOperation({ summary: 'End the active break' })
  async endBreak(@Req() req: any) {
    return this.attendanceService.endBreak(req.user.id);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get active attendance shift status for current user' })
  async getStatus(@Req() req: any) {
    return this.attendanceService.getStatus(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get attendance history for current user' })
  async getHistory(@Req() req: any) {
    return this.attendanceService.getHistory(req.user.id);
  }
}
