import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Location } from './location.entity';
import { Attendance } from './attendance.entity';
import { Leave } from './leave.entity';
import { TaskItem } from './task-item.entity';
import { Blocker } from './blocker.entity';

export enum UserRole {
  SUPER_ADMIN = 'SuperAdmin',
  LINE_MANAGER = 'LineManager',
  EMPLOYEE = 'Employee',
  INTERN = 'Intern',
}

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', select: false }) // Explicitly type to avoid reflect-metadata union bugs
  passwordHash?: string;

  @Column()
  fullName: string;

  @Column({
    type: 'text',
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true }) // Explicitly type to avoid reflect-metadata union bugs
  managerId?: string | null;

  @ManyToOne(() => User, (user) => user.managedEmployees, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'managerId' })
  manager?: User | null;

  @OneToMany(() => User, (user) => user.manager)
  managedEmployees: User[];

  @Column()
  department: string;

  @Column({ type: 'uuid', nullable: true }) // Explicitly type to avoid reflect-metadata union bugs
  assignedLocationId?: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedLocationId' })
  assignedLocation?: Location | null;

  @OneToMany(() => Attendance, (attendance) => attendance.employee)
  attendances: Attendance[];

  @OneToMany(() => Leave, (leave) => leave.employee)
  leaves: Leave[];

  @OneToMany(() => TaskItem, (task) => task.createdBy)
  tasksCreated: TaskItem[];

  @OneToMany(() => TaskItem, (task) => task.assignedTo)
  tasksAssigned: TaskItem[];

  @OneToMany(() => Blocker, (blocker) => blocker.reportedBy)
  blockersReported: Blocker[];
}
