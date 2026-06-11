import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import type { Role } from "../shared/types";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Teachers from "./pages/Teachers";
import TeacherDetail from "./pages/TeacherDetail";
import Classes from "./pages/Classes";
import Subjects from "./pages/Subjects";
import Attendance from "./pages/Attendance";
import Grades from "./pages/Grades";
import Assignments from "./pages/Assignments";
import Announcements from "./pages/Announcements";
import Timetable from "./pages/Timetable";
import SchoolSettings from "./pages/SchoolSettings";
import Profile from "./pages/Profile";

const ADMINS: Role[] = ["super_admin", "school_admin"];

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/students"
          element={
            <RequireRole roles={[...ADMINS, "teacher"]}>
              <Students />
            </RequireRole>
          }
        />
        <Route
          path="/students/:id"
          element={
            <RequireRole roles={[...ADMINS, "teacher"]}>
              <StudentDetail />
            </RequireRole>
          }
        />
        <Route
          path="/teachers"
          element={
            <RequireRole roles={ADMINS}>
              <Teachers />
            </RequireRole>
          }
        />
        <Route
          path="/teachers/:id"
          element={
            <RequireRole roles={ADMINS}>
              <TeacherDetail />
            </RequireRole>
          }
        />
        <Route
          path="/classes"
          element={
            <RequireRole roles={ADMINS}>
              <Classes />
            </RequireRole>
          }
        />
        <Route
          path="/subjects"
          element={
            <RequireRole roles={ADMINS}>
              <Subjects />
            </RequireRole>
          }
        />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route
          path="/settings/school"
          element={
            <RequireRole roles={ADMINS}>
              <SchoolSettings />
            </RequireRole>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
