import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Break } from './break.entity';

@Entity('Attendances')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @ManyToOne(() => User, (user) => user.attendances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: User;

  @Column({ type: 'timestamp with time zone' })
  checkInTime: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  checkOutTime: Date;

  @Column()
  isOnsite: boolean;

  @Column('double precision')
  checkInLatitude: number;

  @Column('double precision')
  checkInLongitude: number;

  @Column('double precision', { nullable: true })
  checkOutLatitude: number;

  @Column('double precision', { nullable: true })
  checkOutLongitude: number;

  @OneToMany(() => Break, (brk) => brk.attendance)
  breaks: Break[];
}
