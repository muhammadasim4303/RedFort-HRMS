import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TaskItem } from './task-item.entity';
import { User } from './user.entity';

@Entity('Blockers')
export class Blocker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  taskId: string;

  @ManyToOne(() => TaskItem, (task) => task.blockers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskItem;

  @Column()
  description: string;

  @Column()
  reportedById: string;

  @ManyToOne(() => User, (user) => user.blockersReported, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reportedById' })
  reportedBy: User;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
