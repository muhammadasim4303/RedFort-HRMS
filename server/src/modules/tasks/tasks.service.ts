import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskItem, TaskPriority, AssignmentStatus, ProgressStatus } from '../../entities/task-item.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Blocker } from '../../entities/blocker.entity';
import { HrmsGateway } from '../../hubs/hrms.gateway';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskItem)
    private readonly taskRepository: Repository<TaskItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Blocker)
    private readonly blockerRepository: Repository<Blocker>,
    private readonly hrmsGateway: HrmsGateway,
  ) {}

  async selfCreateTask(title: string, description: string, deadline: Date, userId: string) {
    const task = this.taskRepository.create({
      title,
      description,
      deadline,
      priority: TaskPriority.MEDIUM,
      createdById: userId,
      assignedToId: userId,
      assignmentStatus: AssignmentStatus.SELF_CREATED,
      progressStatus: ProgressStatus.PENDING,
    });
    return this.taskRepository.save(task);
  }

  async assignTask(
    title: string,
    description: string,
    deadline: Date,
    priority: TaskPriority,
    assignedToId: string,
    managerId: string,
    managerName: string,
    role: UserRole,
  ) {
    const employee = await this.userRepository.findOne({ where: { id: assignedToId } });
    if (!employee) {
      throw new NotFoundException('Assigned employee not found.');
    }

    if (role === UserRole.LINE_MANAGER) {
      if (employee.managerId !== managerId) {
        throw new ForbiddenException('You can only assign tasks to employees you manage.');
      }
    }

    const task = this.taskRepository.create({
      title,
      description,
      deadline,
      priority,
      createdById: managerId,
      assignedToId,
      assignmentStatus: AssignmentStatus.PENDING_ACCEPTANCE,
      progressStatus: ProgressStatus.PENDING,
    });

    await this.taskRepository.save(task);

    // Real-time push notification via WebSockets
    this.hrmsGateway.sendToUser(assignedToId, 'ReceiveTaskAssignment', {
      message: `This task is assigned to you by ${managerName} and this is the deadline: ${task.deadline.toISOString()}`,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        priority: task.priority,
        assignmentStatus: task.assignmentStatus,
        progressStatus: task.progressStatus,
        createdByFullName: managerName,
      },
    });

    return task;
  }

  async respondToTask(taskId: string, accept: boolean, rejectionReason: string | null, userId: string, fullName: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You can only respond to your own assigned tasks.');
    }

    if (task.assignmentStatus !== AssignmentStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('This task has already been processed or is self-created.');
    }

    if (accept) {
      task.assignmentStatus = AssignmentStatus.ACCEPTED;
      task.rejectionReason = null;
    } else {
      if (!rejectionReason) {
        throw new BadRequestException('A reason is required when rejecting a task.');
      }
      task.assignmentStatus = AssignmentStatus.REJECTED;
      task.rejectionReason = rejectionReason;
    }

    await this.taskRepository.save(task);

    // Notify manager of task response
    this.hrmsGateway.sendToUser(task.createdById, 'ReceiveTaskResponse', {
      taskId: task.id,
      taskTitle: task.title,
      employeeName: fullName,
      status: task.assignmentStatus,
      reason: task.rejectionReason,
    });

    return task;
  }

  async forceAssignTask(taskId: string, managerId: string, role: UserRole) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (role === UserRole.LINE_MANAGER && task.createdById !== managerId) {
      throw new ForbiddenException('Only the manager who created this task can force assign it.');
    }

    task.assignmentStatus = AssignmentStatus.FORCE_ASSIGNED;
    task.rejectionReason = null;
    await this.taskRepository.save(task);

    if (task.assignedToId) {
      this.hrmsGateway.sendToUser(task.assignedToId, 'ReceiveTaskAssignment', {
        message: `This task has been force assigned to you. Deadline: ${task.deadline.toISOString()}`,
        task,
      });
    }

    return task;
  }

  async reassignTask(taskId: string, assignedToId: string, managerId: string, managerName: string, role: UserRole) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (role === UserRole.LINE_MANAGER && task.createdById !== managerId) {
      throw new ForbiddenException('Only the creator can reassign this task.');
    }

    const newEmployee = await this.userRepository.findOne({ where: { id: assignedToId } });
    if (!newEmployee) {
      throw new NotFoundException('New assigned employee not found.');
    }

    if (role === UserRole.LINE_MANAGER && newEmployee.managerId !== managerId) {
      throw new ForbiddenException('New employee must be managed by this manager.');
    }

    task.assignedToId = assignedToId;
    task.assignmentStatus = AssignmentStatus.PENDING_ACCEPTANCE;
    task.rejectionReason = null;

    await this.taskRepository.save(task);

    // Notify the new employee
    this.hrmsGateway.sendToUser(assignedToId, 'ReceiveTaskAssignment', {
      message: `This task is reassigned to you by ${managerName}. Deadline: ${task.deadline.toISOString()}`,
      task,
    });

    return task;
  }

  async removeTask(taskId: string, managerId: string, role: UserRole) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (role === UserRole.LINE_MANAGER && task.createdById !== managerId) {
      throw new ForbiddenException('Only the creator can delete this task.');
    }

    await this.taskRepository.remove(task);
    return { message: 'Task removed successfully.' };
  }

  async updateProgress(taskId: string, progressStatus: ProgressStatus, userId: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You can only update the progress of tasks assigned to you.');
    }

    task.progressStatus = progressStatus;
    await this.taskRepository.save(task);

    // Notify manager of task progress
    this.hrmsGateway.sendToUser(task.createdById, 'ReceiveTaskProgressUpdate', {
      taskId: task.id,
      taskTitle: task.title,
      progressStatus: task.progressStatus,
    });

    return task;
  }

  async getTasks(userId: string, role: UserRole) {
    if (role === UserRole.LINE_MANAGER || role === UserRole.SUPER_ADMIN) {
      return this.taskRepository.find({
        where: { createdById: userId },
        relations: { assignedTo: true, blockers: true },
        order: { deadline: 'DESC' },
      });
    } else {
      return this.taskRepository.find({
        where: { assignedToId: userId },
        relations: { blockers: true },
        order: { deadline: 'DESC' },
      });
    }
  }

  async getEmployeeSelfCreatedTasks(managerId: string, role: UserRole) {
    // Get all employees managed by this manager
    let employeeIds: string[] = [];
    if (role === UserRole.SUPER_ADMIN) {
      const allUsers = await this.userRepository.find();
      employeeIds = allUsers.map(u => u.id);
    } else {
      const managedEmployees = await this.userRepository.find({
        where: { managerId },
      });
      employeeIds = managedEmployees.map(e => e.id);
    }

    if (employeeIds.length === 0) return [];

    // Fetch all self-created tasks by those employees
    return this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.blockers', 'blockers')
      .where('task.assignmentStatus = :status', { status: AssignmentStatus.SELF_CREATED })
      .andWhere('task.assignedToId IN (:...ids)', { ids: employeeIds })
      .orderBy('task.deadline', 'DESC')
      .getMany();
  }

  async reportBlocker(taskId: string, description: string, userId: string, userFullName: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You can only report blockers on tasks assigned to you.');
    }

    const blocker = this.blockerRepository.create({
      taskId,
      description,
      reportedById: userId,
    });

    await this.blockerRepository.save(blocker);

    // Notify manager
    this.hrmsGateway.sendToUser(task.createdById, 'ReceiveBlockerReported', {
      taskId: task.id,
      taskTitle: task.title,
      blockerId: blocker.id,
      blockerDescription: blocker.description,
      employeeName: userFullName,
    });

    return blocker;
  }

  async getBlockers(taskId: string, userId: string, role: UserRole) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (task.createdById !== userId && task.assignedToId !== userId && role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You are not authorized to view blockers for this task.');
    }

    return this.blockerRepository.find({
      where: { taskId },
      relations: { reportedBy: true },
      order: { createdAt: 'DESC' },
    });
  }
}
