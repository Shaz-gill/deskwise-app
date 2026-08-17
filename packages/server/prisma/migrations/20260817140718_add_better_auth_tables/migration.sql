-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'agent');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'agent';
