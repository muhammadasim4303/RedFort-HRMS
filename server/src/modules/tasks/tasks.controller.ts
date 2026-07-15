import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { TaskPriority, ProgressStatus } from '../../entities/task-item.entity';
import { IsNotEmpty, IsString, IsEnum, IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class SelfCreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  deadline: string;
}

class AssignTaskDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  deadline: string;

  @IsNotEmpty()
  priority: any;

  @IsUUID()
  assignedToId: string;
}

class RespondTaskDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

class ReassignTaskDto {
  @IsUUID()
  assignedToId: string;
}

class UpdateProgressDto {
  @IsNotEmpty()
  progressStatus: any;
}

class ReportBlockerDto {
  @IsUUID()
  taskId: string;

  @IsNotEmpty()
  @IsString()
  description: string;
}

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('api/v1/tasks/self-create')
  @ApiOperation({ summary: 'Employee creates a self daily task' })
  async selfCreate(@Req() req: any, @Body() body: SelfCreateTaskDto) {
    return this.tasksService.selfCreateTask(
      body.title,
      body.description || '',
      new Date(body.deadline),
      req.user.id,
    );
  }

  @Post('api/v1/tasks/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manager assigns task to employee' })
  async assignTask(@Req() req: any, @Body() body: AssignTaskDto) {
    let mappedPriority = body.priority;
    if (mappedPriority === 0 || mappedPriority === '0') mappedPriority = TaskPriority.LOW;
    else if (mappedPriority === 1 || mappedPriority === '1') mappedPriority = TaskPriority.MEDIUM;
    else if (mappedPriority === 2 || mappedPriority === '2') mappedPriority = TaskPriority.HIGH;
    else if (mappedPriority === 3 || mappedPriority === '3') mappedPriority = TaskPriority.CRITICAL;

    return this.tasksService.assignTask(
      body.title,
      body.description || '',
      new Date(body.deadline),
      mappedPriority,
      body.assignedToId,
      req.user.id,
      req.user.fullName,
      req.user.role,
    );
  }

  @Post('api/v1/tasks/:id/respond')
  @ApiOperation({ summary: 'Employee accepts or rejects task assignment' })
  async respondToTask(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: RespondTaskDto,
  ) {
    return this.tasksService.respondToTask(
      id,
      body.accept,
      body.rejectionReason || null,
      req.user.id,
      req.user.fullName,
    );
  }

  @Post('api/v1/tasks/:id/force-assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manager force assigns task (overrides rejection)' })
  async forceAssign(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.forceAssignTask(id, req.user.id, req.user.role);
  }

  @Put('api/v1/tasks/:id/reassign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manager reassigns task to another user' })
  async reassign(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: ReassignTaskDto,
  ) {
    return this.tasksService.reassignTask(
      id,
      body.assignedToId,
      req.user.id,
      req.user.fullName,
      req.user.role,
    );
  }

  @Delete('api/v1/tasks/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manager removes task' })
  async removeTask(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.removeTask(id, req.user.id, req.user.role);
  }

  @Put('api/v1/tasks/:id/progress')
  @ApiOperation({ summary: 'Employee updates task progress status' })
  async updateProgress(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: UpdateProgressDto,
  ) {
    let mappedStatus = body.progressStatus;
    if (mappedStatus === 0 || mappedStatus === '0') mappedStatus = ProgressStatus.PENDING;
    else if (mappedStatus === 1 || mappedStatus === '1') mappedStatus = ProgressStatus.IN_PROGRESS;
    else if (mappedStatus === 2 || mappedStatus === '2') mappedStatus = ProgressStatus.COMPLETED;

    return this.tasksService.updateProgress(id, mappedStatus, req.user.id);
  }

  @Get('api/v1/tasks/employee-created')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LINE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get self-created tasks by managed employees' })
  async getEmployeeSelfCreatedTasks(@Req() req: any) {
    return this.tasksService.getEmployeeSelfCreatedTasks(req.user.id, req.user.role);
  }

  @Get('api/v1/tasks')
  @ApiOperation({ summary: 'Get list of tasks based on active user role' })
  async getTasks(@Req() req: any) {
    return this.tasksService.getTasks(req.user.id, req.user.role);
  }

  @Post('api/v1/blockers')
  @ApiOperation({ summary: 'Employee reports a task blocker/impediment' })
  async reportBlocker(@Req() req: any, @Body() body: ReportBlockerDto) {
    return this.tasksService.reportBlocker(
      body.taskId,
      body.description,
      req.user.id,
      req.user.fullName,
    );
  }

  @Get('api/v1/blockers/task/:taskId')
  @ApiOperation({ summary: 'Get blockers reported on a task' })
  async getBlockers(@Param('taskId') taskId: string, @Req() req: any) {
    return this.tasksService.getBlockers(taskId, req.user.id, req.user.role);
  }
}
