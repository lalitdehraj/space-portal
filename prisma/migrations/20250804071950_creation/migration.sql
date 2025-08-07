-- CreateTable
CREATE TABLE "public"."Room" (
    "room_id" SERIAL NOT NULL,
    "room_number" TEXT NOT NULL,
    "building_id" INTEGER NOT NULL,
    "floor_id" INTEGER NOT NULL,
    "room_type_id" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "key_number" TEXT,
    "status" TEXT NOT NULL,
    "room_area" TEXT,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "public"."Allocation" (
    "allocation_id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "allocated_to_department_id" INTEGER,
    "allocated_to_employee_id" INTEGER,
    "academic_year" TEXT,
    "academic_session" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "allocation_type" TEXT,
    "key_assigned_to_employee_id" INTEGER,
    "remarks" TEXT,
    "is_active" BOOLEAN,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("allocation_id")
);

-- CreateTable
CREATE TABLE "public"."Request" (
    "request_id" SERIAL NOT NULL,
    "requested_by_employee_id" INTEGER,
    "requested_by_department_id" INTEGER,
    "room_type_requested" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "priority" TEXT,
    "date_of_request" TIMESTAMP(3) NOT NULL,
    "required_date" TIMESTAMP(3) NOT NULL,
    "required_time_start" TIMESTAMP(3) NOT NULL,
    "required_time_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "allocated_room_id" INTEGER,
    "approved_by_employee_id" INTEGER,
    "approval_date" TIMESTAMP(3),
    "recurrence" TEXT,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "public"."FacultyBlockDetail" (
    "faculty_block_unit_id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "unit_number" TEXT,
    "unit_type" TEXT,
    "assigned_to_employee_id" INTEGER,
    "key_number" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),

    CONSTRAINT "FacultyBlockDetail_pkey" PRIMARY KEY ("faculty_block_unit_id")
);

-- CreateTable
CREATE TABLE "public"."TimetableUtilization" (
    "utilization_id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "academic_year" TEXT,
    "academic_session" TEXT,
    "day_of_week" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "activity_type" TEXT,
    "activity_details" TEXT,
    "organized_by" TEXT,

    CONSTRAINT "TimetableUtilization_pkey" PRIMARY KEY ("utilization_id")
);

-- CreateTable
CREATE TABLE "public"."Building" (
    "building_id" SERIAL NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "contact" TEXT,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("building_id")
);

-- CreateTable
CREATE TABLE "public"."Floor" (
    "floor_id" SERIAL NOT NULL,
    "floor_number" TEXT,
    "building_id" INTEGER,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("floor_id")
);

-- CreateTable
CREATE TABLE "public"."RoomType" (
    "room_type_id" SERIAL NOT NULL,
    "type_name" TEXT,
    "description" TEXT,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("room_type_id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "department_id" SERIAL NOT NULL,
    "name" TEXT,
    "head_id" INTEGER,
    "contact_info" TEXT,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "employee_id" SERIAL NOT NULL,
    "name" TEXT,
    "department_id" INTEGER,
    "designation" TEXT,
    "contact_info" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("employee_id")
);

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."Building"("building_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "public"."Floor"("floor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."RoomType"("room_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."Room"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_allocated_to_department_id_fkey" FOREIGN KEY ("allocated_to_department_id") REFERENCES "public"."Department"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_allocated_to_employee_id_fkey" FOREIGN KEY ("allocated_to_employee_id") REFERENCES "public"."Employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_key_assigned_to_employee_id_fkey" FOREIGN KEY ("key_assigned_to_employee_id") REFERENCES "public"."Employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_requested_by_employee_id_fkey" FOREIGN KEY ("requested_by_employee_id") REFERENCES "public"."Employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_requested_by_department_id_fkey" FOREIGN KEY ("requested_by_department_id") REFERENCES "public"."Department"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_allocated_room_id_fkey" FOREIGN KEY ("allocated_room_id") REFERENCES "public"."Room"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_approved_by_employee_id_fkey" FOREIGN KEY ("approved_by_employee_id") REFERENCES "public"."Employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FacultyBlockDetail" ADD CONSTRAINT "FacultyBlockDetail_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."Room"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FacultyBlockDetail" ADD CONSTRAINT "FacultyBlockDetail_assigned_to_employee_id_fkey" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "public"."Employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableUtilization" ADD CONSTRAINT "TimetableUtilization_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."Room"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableUtilization" ADD CONSTRAINT "TimetableUtilization_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."Department"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Floor" ADD CONSTRAINT "Floor_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."Building"("building_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."Department"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;
