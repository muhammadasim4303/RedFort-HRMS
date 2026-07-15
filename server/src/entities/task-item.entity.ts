import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Blocker } from './blocker.entity';

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum AssignmentStatus {
  SELF_CREATED = 'SelfCreated',
  PENDING_ACCEPTANCE = 'PendingAcceptance',
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  FORCE_ASSIGNED = 'ForceAssigned',
}

export enum ProgressStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'InProgress',
  COMPLETED = 'Completed',
}

@Entity('Tasks')
export class TaskItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ default: '' })
  description: string;

  @Column({ type: 'timestamp with time zone' })
  deadline: Date;

  @Column({
    type: 'text',
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column()
  createdById: string;

  @ManyToOne(() => User, (user) => user.tasksCreated, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'uuid', nullable: true }) // Explicitly type to avoid reflect-metadata union bugs
  assignedToId?: string | null;

  @ManyToOne(() => User, (user) => user.tasksAssigned, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo?: User | null;

  @Column({
    type: 'text',
    default: AssignmentStatus.SELF_CREATED,
  })
  assignmentStatus: AssignmentStatus;

  @Column({ type: 'text', nullable: true }) // Explicitly type to avoid reflect-metadata union bugs
  rejectionReason?: string | null;

  @Column({
    type: 'text',
    default: ProgressStatus.PENDING,
  })
  progressStatus: ProgressStatus;

  @OneToMany(() => Blocker, (blocker) => blocker.task)
  blockers: Blocker[];
}
