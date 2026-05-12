-- CreateTable
CREATE TABLE "FleetState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetLogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fleetId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetRobotLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fleetId" TEXT NOT NULL,
    "robotName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetRobotLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetRobotLogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetRobotLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "category" TEXT,
    "status" TEXT,
    "assignedTo" TEXT,
    "fleetName" TEXT,
    "robotName" TEXT,
    "unixMillisStartTime" TIMESTAMP(3),
    "unixMillisFinishTime" TIMESTAMP(3),
    "unixMillisRequestTime" TIMESTAMP(3),
    "requester" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLabel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "labelName" TEXT NOT NULL,
    "labelValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEventLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEventLogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventLogId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEventLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEventPhase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventLogId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskEventPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEventPhaseLogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEventPhaseLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEventPhaseEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskEventPhaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEventPhaseEventLogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEventPhaseEventLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskFavorite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" JSONB NOT NULL,
    "user" TEXT NOT NULL,
    "taskDefinitionId" TEXT,
    "unixMillisEarliestStartTime" BIGINT,
    "priority" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskRequest" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lastRan" TIMESTAMP(3),
    "startFrom" TIMESTAMP(3),
    "until" TIMESTAMP(3),
    "exceptDates" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledTaskSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scheduledTaskId" TEXT NOT NULL,
    "every" INTEGER,
    "period" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledTaskSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestTime" TIMESTAMP(3) NOT NULL,
    "responseExpected" BOOLEAN NOT NULL,
    "taskId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertRequestId" TEXT NOT NULL,
    "responseTime" TIMESTAMP(3) NOT NULL,
    "response" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourcePermission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authzGrp" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourcePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoorState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispenserState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispenserState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestorState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestorState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beacon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beacon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetState_tenantId_idx" ON "FleetState"("tenantId");

-- CreateIndex
CREATE INDEX "FleetState_name_idx" ON "FleetState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FleetState_tenantId_name_key" ON "FleetState"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FleetLog_tenantId_idx" ON "FleetLog"("tenantId");

-- CreateIndex
CREATE INDEX "FleetLog_name_idx" ON "FleetLog"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FleetLog_tenantId_name_key" ON "FleetLog"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FleetLogEntry_tenantId_idx" ON "FleetLogEntry"("tenantId");

-- CreateIndex
CREATE INDEX "FleetLogEntry_fleetId_idx" ON "FleetLogEntry"("fleetId");

-- CreateIndex
CREATE INDEX "FleetLogEntry_tier_idx" ON "FleetLogEntry"("tier");

-- CreateIndex
CREATE INDEX "FleetLogEntry_timestamp_idx" ON "FleetLogEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "FleetLogEntry_tenantId_fleetId_seq_key" ON "FleetLogEntry"("tenantId", "fleetId", "seq");

-- CreateIndex
CREATE INDEX "FleetRobotLog_tenantId_idx" ON "FleetRobotLog"("tenantId");

-- CreateIndex
CREATE INDEX "FleetRobotLog_fleetId_idx" ON "FleetRobotLog"("fleetId");

-- CreateIndex
CREATE INDEX "FleetRobotLog_robotName_idx" ON "FleetRobotLog"("robotName");

-- CreateIndex
CREATE UNIQUE INDEX "FleetRobotLog_tenantId_fleetId_robotName_key" ON "FleetRobotLog"("tenantId", "fleetId", "robotName");

-- CreateIndex
CREATE INDEX "FleetRobotLogEntry_tenantId_idx" ON "FleetRobotLogEntry"("tenantId");

-- CreateIndex
CREATE INDEX "FleetRobotLogEntry_robotId_idx" ON "FleetRobotLogEntry"("robotId");

-- CreateIndex
CREATE INDEX "FleetRobotLogEntry_tier_idx" ON "FleetRobotLogEntry"("tier");

-- CreateIndex
CREATE INDEX "FleetRobotLogEntry_timestamp_idx" ON "FleetRobotLogEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "FleetRobotLogEntry_tenantId_robotId_seq_key" ON "FleetRobotLogEntry"("tenantId", "robotId", "seq");

-- CreateIndex
CREATE INDEX "TaskRequest_tenantId_idx" ON "TaskRequest"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskRequest_tenantId_id_key" ON "TaskRequest"("tenantId", "id");

-- CreateIndex
CREATE INDEX "TaskState_tenantId_idx" ON "TaskState"("tenantId");

-- CreateIndex
CREATE INDEX "TaskState_status_idx" ON "TaskState"("status");

-- CreateIndex
CREATE INDEX "TaskState_category_idx" ON "TaskState"("category");

-- CreateIndex
CREATE INDEX "TaskState_assignedTo_idx" ON "TaskState"("assignedTo");

-- CreateIndex
CREATE INDEX "TaskState_unixMillisStartTime_idx" ON "TaskState"("unixMillisStartTime");

-- CreateIndex
CREATE INDEX "TaskState_unixMillisFinishTime_idx" ON "TaskState"("unixMillisFinishTime");

-- CreateIndex
CREATE INDEX "TaskState_unixMillisRequestTime_idx" ON "TaskState"("unixMillisRequestTime");

-- CreateIndex
CREATE UNIQUE INDEX "TaskState_tenantId_id_key" ON "TaskState"("tenantId", "id");

-- CreateIndex
CREATE INDEX "TaskLabel_tenantId_idx" ON "TaskLabel"("tenantId");

-- CreateIndex
CREATE INDEX "TaskLabel_taskId_idx" ON "TaskLabel"("taskId");

-- CreateIndex
CREATE INDEX "TaskLabel_labelName_idx" ON "TaskLabel"("labelName");

-- CreateIndex
CREATE INDEX "TaskLabel_labelValue_idx" ON "TaskLabel"("labelValue");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLabel_tenantId_taskId_labelName_key" ON "TaskLabel"("tenantId", "taskId", "labelName");

-- CreateIndex
CREATE INDEX "TaskLog_tenantId_idx" ON "TaskLog"("tenantId");

-- CreateIndex
CREATE INDEX "TaskLog_taskId_idx" ON "TaskLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskLog_tier_idx" ON "TaskLog"("tier");

-- CreateIndex
CREATE INDEX "TaskLog_timestamp_idx" ON "TaskLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLog_tenantId_taskId_seq_key" ON "TaskLog"("tenantId", "taskId", "seq");

-- CreateIndex
CREATE INDEX "TaskEventLog_tenantId_idx" ON "TaskEventLog"("tenantId");

-- CreateIndex
CREATE INDEX "TaskEventLog_taskId_idx" ON "TaskEventLog"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEventLog_tenantId_taskId_key" ON "TaskEventLog"("tenantId", "taskId");

-- CreateIndex
CREATE INDEX "TaskEventLogEntry_tenantId_idx" ON "TaskEventLogEntry"("tenantId");

-- CreateIndex
CREATE INDEX "TaskEventLogEntry_eventLogId_idx" ON "TaskEventLogEntry"("eventLogId");

-- CreateIndex
CREATE INDEX "TaskEventLogEntry_tier_idx" ON "TaskEventLogEntry"("tier");

-- CreateIndex
CREATE INDEX "TaskEventLogEntry_timestamp_idx" ON "TaskEventLogEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEventLogEntry_tenantId_eventLogId_seq_key" ON "TaskEventLogEntry"("tenantId", "eventLogId", "seq");

-- CreateIndex
CREATE INDEX "TaskEventPhase_tenantId_idx" ON "TaskEventPhase"("tenantId");

-- CreateIndex
CREATE INDEX "TaskEventPhase_eventLogId_idx" ON "TaskEventPhase"("eventLogId");

-- CreateIndex
CREATE INDEX "TaskEventPhase_phase_idx" ON "TaskEventPhase"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEventPhase_tenantId_eventLogId_phase_key" ON "TaskEventPhase"("tenantId", "eventLogId", "phase");

-- CreateIndex
CREATE INDEX "TaskEventPhaseLogEntry_tenantId_idx" ON "TaskEventPhaseLogEntry"("tenantId");

-- CreateIndex
CREATE INDEX "TaskEventPhaseLogEntry_phaseId_idx" ON "TaskEventPhaseLogEntry"("phaseId");

-- CreateIndex
CREATE INDEX "TaskEventPhaseLogEntry_tier_idx" ON "TaskEventPhaseLogEntry"("tier");

-- CreateIndex
CREATE INDEX "TaskEventPhaseLogEntry_timestamp_idx" ON "TaskEventPhaseLogEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEventPhaseLogEntry_tenantId_phaseId_seq_key" ON "TaskEventPhaseLogEntry"("tenantId", "phaseId", "seq");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEvent_tenantId_idx" ON "TaskEventPhaseEvent"("tenantId");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEvent_phaseId_idx" ON "TaskEventPhaseEvent"("phaseId");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEvent_event_idx" ON "TaskEventPhaseEvent"("event");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEventPhaseEvent_tenantId_phaseId_event_key" ON "TaskEventPhaseEvent"("tenantId", "phaseId", "event");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEventLogEntry_tenantId_idx" ON "TaskEventPhaseEventLogEntry"("tenantId");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEventLogEntry_eventId_idx" ON "TaskEventPhaseEventLogEntry"("eventId");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEventLogEntry_tier_idx" ON "TaskEventPhaseEventLogEntry"("tier");

-- CreateIndex
CREATE INDEX "TaskEventPhaseEventLogEntry_timestamp_idx" ON "TaskEventPhaseEventLogEntry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEventPhaseEventLogEntry_tenantId_eventId_seq_key" ON "TaskEventPhaseEventLogEntry"("tenantId", "eventId", "seq");

-- CreateIndex
CREATE INDEX "TaskFavorite_tenantId_idx" ON "TaskFavorite"("tenantId");

-- CreateIndex
CREATE INDEX "TaskFavorite_user_idx" ON "TaskFavorite"("user");

-- CreateIndex
CREATE INDEX "TaskFavorite_category_idx" ON "TaskFavorite"("category");

-- CreateIndex
CREATE INDEX "TaskFavorite_taskDefinitionId_idx" ON "TaskFavorite"("taskDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFavorite_tenantId_id_key" ON "TaskFavorite"("tenantId", "id");

-- CreateIndex
CREATE INDEX "ScheduledTask_tenantId_idx" ON "ScheduledTask"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledTask_createdBy_idx" ON "ScheduledTask"("createdBy");

-- CreateIndex
CREATE INDEX "ScheduledTask_startFrom_idx" ON "ScheduledTask"("startFrom");

-- CreateIndex
CREATE INDEX "ScheduledTask_until_idx" ON "ScheduledTask"("until");

-- CreateIndex
CREATE INDEX "ScheduledTaskSchedule_tenantId_idx" ON "ScheduledTaskSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledTaskSchedule_scheduledTaskId_idx" ON "ScheduledTaskSchedule"("scheduledTaskId");

-- CreateIndex
CREATE INDEX "ScheduledTaskSchedule_period_idx" ON "ScheduledTaskSchedule"("period");

-- CreateIndex
CREATE INDEX "AlertRequest_tenantId_idx" ON "AlertRequest"("tenantId");

-- CreateIndex
CREATE INDEX "AlertRequest_requestTime_idx" ON "AlertRequest"("requestTime");

-- CreateIndex
CREATE INDEX "AlertRequest_responseExpected_idx" ON "AlertRequest"("responseExpected");

-- CreateIndex
CREATE INDEX "AlertRequest_taskId_idx" ON "AlertRequest"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRequest_tenantId_id_key" ON "AlertRequest"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AlertResponse_alertRequestId_key" ON "AlertResponse"("alertRequestId");

-- CreateIndex
CREATE INDEX "AlertResponse_tenantId_idx" ON "AlertResponse"("tenantId");

-- CreateIndex
CREATE INDEX "AlertResponse_alertRequestId_idx" ON "AlertResponse"("alertRequestId");

-- CreateIndex
CREATE INDEX "AlertResponse_responseTime_idx" ON "AlertResponse"("responseTime");

-- CreateIndex
CREATE INDEX "AlertResponse_response_idx" ON "AlertResponse"("response");

-- CreateIndex
CREATE INDEX "Alert_tenantId_idx" ON "Alert"("tenantId");

-- CreateIndex
CREATE INDEX "Alert_alertId_idx" ON "Alert"("alertId");

-- CreateIndex
CREATE INDEX "Alert_category_idx" ON "Alert"("category");

-- CreateIndex
CREATE INDEX "Alert_tier_idx" ON "Alert"("tier");

-- CreateIndex
CREATE INDEX "Alert_acknowledged_idx" ON "Alert"("acknowledged");

-- CreateIndex
CREATE INDEX "Alert_respondedAt_idx" ON "Alert"("respondedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_tenantId_alertId_key" ON "Alert"("tenantId", "alertId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_isAdmin_idx" ON "User"("isAdmin");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE INDEX "UserRole_tenantId_idx" ON "UserRole"("tenantId");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_tenantId_userId_roleId_key" ON "UserRole"("tenantId", "userId", "roleId");

-- CreateIndex
CREATE INDEX "ResourcePermission_tenantId_idx" ON "ResourcePermission"("tenantId");

-- CreateIndex
CREATE INDEX "ResourcePermission_authzGrp_idx" ON "ResourcePermission"("authzGrp");

-- CreateIndex
CREATE INDEX "ResourcePermission_roleId_idx" ON "ResourcePermission"("roleId");

-- CreateIndex
CREATE INDEX "ResourcePermission_action_idx" ON "ResourcePermission"("action");

-- CreateIndex
CREATE UNIQUE INDEX "ResourcePermission_tenantId_authzGrp_roleId_action_key" ON "ResourcePermission"("tenantId", "authzGrp", "roleId", "action");

-- CreateIndex
CREATE INDEX "BuildingMap_tenantId_idx" ON "BuildingMap"("tenantId");

-- CreateIndex
CREATE INDEX "BuildingMap_name_idx" ON "BuildingMap"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingMap_tenantId_name_key" ON "BuildingMap"("tenantId", "name");

-- CreateIndex
CREATE INDEX "DoorState_tenantId_idx" ON "DoorState"("tenantId");

-- CreateIndex
CREATE INDEX "DoorState_name_idx" ON "DoorState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DoorState_tenantId_name_key" ON "DoorState"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LiftState_tenantId_idx" ON "LiftState"("tenantId");

-- CreateIndex
CREATE INDEX "LiftState_name_idx" ON "LiftState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LiftState_tenantId_name_key" ON "LiftState"("tenantId", "name");

-- CreateIndex
CREATE INDEX "DispenserState_tenantId_idx" ON "DispenserState"("tenantId");

-- CreateIndex
CREATE INDEX "DispenserState_name_idx" ON "DispenserState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DispenserState_tenantId_name_key" ON "DispenserState"("tenantId", "name");

-- CreateIndex
CREATE INDEX "IngestorState_tenantId_idx" ON "IngestorState"("tenantId");

-- CreateIndex
CREATE INDEX "IngestorState_name_idx" ON "IngestorState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IngestorState_tenantId_name_key" ON "IngestorState"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Beacon_tenantId_idx" ON "Beacon"("tenantId");

-- CreateIndex
CREATE INDEX "Beacon_name_idx" ON "Beacon"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Beacon_tenantId_name_key" ON "Beacon"("tenantId", "name");

-- CreateIndex
CREATE INDEX "DeliveryAlert_tenantId_idx" ON "DeliveryAlert"("tenantId");

-- CreateIndex
CREATE INDEX "DeliveryAlert_alertId_idx" ON "DeliveryAlert"("alertId");

-- CreateIndex
CREATE INDEX "DeliveryAlert_category_idx" ON "DeliveryAlert"("category");

-- CreateIndex
CREATE INDEX "DeliveryAlert_tier_idx" ON "DeliveryAlert"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAlert_tenantId_alertId_key" ON "DeliveryAlert"("tenantId", "alertId");

-- AddForeignKey
ALTER TABLE "FleetLogEntry" ADD CONSTRAINT "FleetLogEntry_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "FleetLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetRobotLog" ADD CONSTRAINT "FleetRobotLog_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "FleetLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetRobotLogEntry" ADD CONSTRAINT "FleetRobotLogEntry_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "FleetRobotLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEventLogEntry" ADD CONSTRAINT "TaskEventLogEntry_eventLogId_fkey" FOREIGN KEY ("eventLogId") REFERENCES "TaskEventLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEventPhase" ADD CONSTRAINT "TaskEventPhase_eventLogId_fkey" FOREIGN KEY ("eventLogId") REFERENCES "TaskEventLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEventPhaseLogEntry" ADD CONSTRAINT "TaskEventPhaseLogEntry_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TaskEventPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEventPhaseEvent" ADD CONSTRAINT "TaskEventPhaseEvent_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TaskEventPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEventPhaseEventLogEntry" ADD CONSTRAINT "TaskEventPhaseEventLogEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TaskEventPhaseEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTaskSchedule" ADD CONSTRAINT "ScheduledTaskSchedule_scheduledTaskId_fkey" FOREIGN KEY ("scheduledTaskId") REFERENCES "ScheduledTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertResponse" ADD CONSTRAINT "AlertResponse_alertRequestId_fkey" FOREIGN KEY ("alertRequestId") REFERENCES "AlertRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePermission" ADD CONSTRAINT "ResourcePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
