import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Attendance } from './attendance.entity';

@Entity('Breaks')
export class Break {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  attendanceId: string;

  @ManyToOne(() => Attendance, (attendance) => attendance.breaks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendanceId' })
  attendance: Attendance;

  @Column({ type: 'timestamp with time zone' })
  startTime: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  endTime: Date;

  @Column({ default: 'Lunch' })
  breakType: string; // Lunch, Tea, Prayer, Custom
}
