import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
@Controller('api/v1/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of managed employees (Manager/Admin only)' })
  async getEmployees(@Req() req: any) {
    return this.employeesService.getEmployees(req.user.id, req.user.role);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get a specific employee check-in and task history logs' })
  async getEmployeeHistory(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.getEmployeeHistory(id, req.user.id, req.user.role);
  }
}
