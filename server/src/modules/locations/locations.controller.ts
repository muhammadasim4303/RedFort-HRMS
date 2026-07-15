import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class CreateLocationDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  radiusInMeters?: number;
}

class AssignLocationDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a favorite location (Manager/Admin only)' })
  async createLocation(@Req() req: any, @Body() body: CreateLocationDto) {
    return this.locationsService.createLocation(
      body.name,
      body.latitude,
      body.longitude,
      body.radiusInMeters ?? 100.0,
      req.user.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get favorite locations' })
  async getLocations(@Req() req: any) {
    return this.locationsService.getFavoriteLocations(req.user.id, req.user.role);
  }

  @Post('assign')
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a location to an employee' })
  async assignLocation(@Req() req: any, @Body() body: AssignLocationDto) {
    return this.locationsService.assignLocation(
      body.employeeId,
      body.locationId || null,
      req.user.id,
      req.user.role,
    );
  }
}
