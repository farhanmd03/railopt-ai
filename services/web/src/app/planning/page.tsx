"use client";

import React, { Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import { getIntegrationOpportunities, getMaintenanceTasks } from "@/lib/api/maintenance";
import { getCandidateBlocks } from "@/lib/api/candidate-blocks";
import { IntegrationOpportunity } from "@/lib/types/maintenance";
import { CandidateBlock } from "@/lib/types/candidate-block";

import { PlanningHeader } from "@/components/planning/planning-header";
import { OpportunityOverviewStrip } from "@/components/planning/opportunity-overview-strip";
import {
  OpportunityExplorer,
  OpportunityFilterState,
} from "@/components/planning/opportunity-explorer";
import { OpportunityDetailDrawer } from "@/components/planning/opportunity-detail-drawer";
import {
  CandidateBlockExplorer,
  CandidateFilterState,
} from "@/components/planning/candidate-block-explorer";
import { CandidateTimeline } from "@/components/planning/candidate-timeline";
import { CandidateDetailDrawer } from "@/components/planning/candidate-detail-drawer";
import { LoadingState } from "@/components/feedback/loading-state";

const INITIAL_OPP_FILTERS: OpportunityFilterState = {
  search: "",
  sectionId: "",
  department: "",
  crossDeptOnly: false,
  minPriority: "",
};

const INITIAL_CAND_FILTERS: CandidateFilterState = {
  search: "",
  sectionId: "",
  feasibilityStatus: "",
  opportunityId: "",
  date: "",
};

function PlanningContent() {
  const auth = useAuth();
  const user = buildAuthUser(auth.user);
  const searchParams = useSearchParams();

  // Deep linking initial parameters
  const initialSection = searchParams.get("section") || "";
  const initialOppId = searchParams.get("opportunity") || "";
  const initialCandId = searchParams.get("candidate") || "";

  // 1. Opportunity state
  const [oppFilters, setOppFilters] = useState<OpportunityFilterState>({
    ...INITIAL_OPP_FILTERS,
    sectionId: initialSection,
  });
  const [oppPage, setOppPage] = useState<number>(1);
  const oppPageSize = 8;
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<IntegrationOpportunity | null>(null);
  const [isOppDrawerOpen, setIsOppDrawerOpen] = useState<boolean>(false);

  // 2. Candidate state
  const [candFilters, setCandFilters] = useState<CandidateFilterState>({
    ...INITIAL_CAND_FILTERS,
    sectionId: initialSection,
    opportunityId: initialOppId,
  });
  const [candPage, setCandPage] = useState<number>(1);
  const candPageSize = 8;
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateBlock | null>(null);
  const [isCandDrawerOpen, setIsCandDrawerOpen] = useState<boolean>(false);

  // 3. Queries
  // (a) Division tasks query for available sections list
  const tasksQuery = useQuery({
    queryKey: ["maintenance-tasks", "sections-list"],
    queryFn: () => getMaintenanceTasks({ page: 1, page_size: 100 }),
  });

  const availableSections = useMemo(() => {
    const raw = tasksQuery.data?.items || [];
    const set = new Set<string>();
    raw.forEach((t) => {
      if (t.section_id) set.add(t.section_id);
    });
    return Array.from(set).sort();
  }, [tasksQuery.data?.items]);

  // (b) Integration opportunities query (server parameters with page & pageSize)
  const oppServerParams = useMemo(() => {
    return {
      page: oppPage,
      page_size: oppPageSize,
      section_id: oppFilters.sectionId || undefined,
      department: oppFilters.department || undefined,
      cross_department: oppFilters.crossDeptOnly || undefined,
      min_priority: oppFilters.minPriority ? parseFloat(oppFilters.minPriority) : undefined,
    };
  }, [
    oppPage,
    oppPageSize,
    oppFilters.sectionId,
    oppFilters.department,
    oppFilters.crossDeptOnly,
    oppFilters.minPriority,
  ]);

  const opportunitiesQuery = useQuery({
    queryKey: ["integration-opportunities", "planning-list", oppServerParams],
    queryFn: () => getIntegrationOpportunities(oppServerParams),
  });

  // Client search filtering for opportunities if search query is entered
  const hasOppSearch = Boolean(oppFilters.search);
  const filteredOpportunities = useMemo(() => {
    const raw = opportunitiesQuery.data?.items || [];
    if (!oppFilters.search) return raw;
    const q = oppFilters.search.toLowerCase().trim();
    return raw.filter((opp) => {
      const matchId = opp.opportunity_id.toLowerCase().includes(q);
      const matchSec = opp.section_id.toLowerCase().includes(q);
      const matchTasks = opp.task_ids.some((t) => t.toLowerCase().includes(q));
      return matchId || matchSec || matchTasks;
    });
  }, [opportunitiesQuery.data?.items, oppFilters.search]);

  const totalFilteredOpps = hasOppSearch
    ? filteredOpportunities.length
    : opportunitiesQuery.data?.total || 0;
  const oppTotalPages = hasOppSearch
    ? Math.ceil(totalFilteredOpps / oppPageSize) || 1
    : opportunitiesQuery.data?.total_pages ||
      Math.ceil(totalFilteredOpps / oppPageSize) ||
      1;
  const pagedOpportunities = hasOppSearch
    ? filteredOpportunities.slice(0, oppPageSize)
    : opportunitiesQuery.data?.items || [];

  // (c) Candidate blocks query (server parameters with page & pageSize)
  const candServerParams = useMemo(() => {
    return {
      page: candPage,
      page_size: candPageSize,
      section_id: candFilters.sectionId || undefined,
      opportunity_id: candFilters.opportunityId || undefined,
      feasibility_status: candFilters.feasibilityStatus || undefined,
      date: candFilters.date || undefined,
    };
  }, [
    candPage,
    candPageSize,
    candFilters.sectionId,
    candFilters.opportunityId,
    candFilters.feasibilityStatus,
    candFilters.date,
  ]);

  const candidatesQuery = useQuery({
    queryKey: ["candidate-blocks", "planning-list", candServerParams],
    queryFn: () => getCandidateBlocks(candServerParams),
  });

  // Client search filtering for candidate blocks if search query is entered
  const hasCandSearch = Boolean(candFilters.search);
  const filteredCandidates = useMemo(() => {
    const raw = candidatesQuery.data?.items || [];
    if (!candFilters.search) return raw;
    const q = candFilters.search.toLowerCase().trim();
    return raw.filter((c) => {
      const matchId = c.candidate_id.toLowerCase().includes(q);
      const matchWindow = c.window_id.toLowerCase().includes(q);
      const matchSec = c.section_id.toLowerCase().includes(q);
      const matchTasks = c.task_ids.some((t) => t.toLowerCase().includes(q));
      return matchId || matchWindow || matchSec || matchTasks;
    });
  }, [candidatesQuery.data?.items, candFilters.search]);

  const totalFilteredCandidates = hasCandSearch
    ? filteredCandidates.length
    : candidatesQuery.data?.total || 0;
  const candTotalPages = hasCandSearch
    ? Math.ceil(totalFilteredCandidates / candPageSize) || 1
    : candidatesQuery.data?.total_pages ||
      Math.ceil(totalFilteredCandidates / candPageSize) ||
      1;
  const pagedCandidates = hasCandSearch
    ? filteredCandidates.slice(0, candPageSize)
    : candidatesQuery.data?.items || [];

  // (d) Division-wide accurate KPI summary counts
  const crossDeptQuery = useQuery({
    queryKey: ["integration-opportunities", "cross-dept-count"],
    queryFn: () => getIntegrationOpportunities({ cross_department: true, page_size: 1 }),
  });
  const crossDeptOppsCount = crossDeptQuery.data?.total ?? 0;

  const feasibleCandsQuery = useQuery({
    queryKey: ["candidate-blocks", "feasible-count"],
    queryFn: () => getCandidateBlocks({ feasibility_status: "FEASIBLE", page_size: 1 }),
  });
  const feasibleCandidatesCount = feasibleCandsQuery.data?.total ?? 0;

  const totalOpportunities = opportunitiesQuery.data?.total ?? 0;
  const compatibleCount = opportunitiesQuery.data?.total ?? 0;
  const totalCandidates = candidatesQuery.data?.total ?? 0;

  const handleSelectOpportunity = (opp: IntegrationOpportunity) => {
    setSelectedOpportunity(opp);
    setIsOppDrawerOpen(true);
  };

  const handleSelectCandidate = (cand: CandidateBlock) => {
    setSelectedCandidate(cand);
    setIsCandDrawerOpen(true);
  };

  const handleFilterCandidatesForOpp = (oppId: string, sectionId: string) => {
    setCandFilters({
      ...candFilters,
      opportunityId: oppId,
      sectionId: sectionId,
    });
    setCandPage(1);
  };

  const handleRefreshAll = async () => {
    await Promise.all([
      opportunitiesQuery.refetch(),
      candidatesQuery.refetch(),
      crossDeptQuery.refetch(),
      feasibleCandsQuery.refetch(),
      tasksQuery.refetch(),
    ]);
  };

  const isRefreshing =
    opportunitiesQuery.isFetching ||
    candidatesQuery.isFetching ||
    crossDeptQuery.isFetching ||
    feasibleCandsQuery.isFetching ||
    tasksQuery.isFetching;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header */}
      <PlanningHeader
        user={user}
        isRefreshing={isRefreshing}
        onRefresh={handleRefreshAll}
      />

      {/* 2. Opportunity & Candidate Overview Strip (Accurate division-wide totals) */}
      <OpportunityOverviewStrip
        totalOpportunities={totalOpportunities}
        crossDeptCount={crossDeptOppsCount}
        compatibleCount={compatibleCount}
        totalCandidates={totalCandidates}
        feasibleCandidatesCount={feasibleCandidatesCount}
        isLoading={opportunitiesQuery.isLoading && !opportunitiesQuery.data}
      />

      {/* 3. Section 1: Integration Opportunities Explorer */}
      <OpportunityExplorer
        opportunities={pagedOpportunities}
        totalOpportunities={totalFilteredOpps}
        page={oppPage}
        pageSize={oppPageSize}
        totalPages={oppTotalPages}
        onPageChange={(p) => setOppPage(p)}
        filters={oppFilters}
        onFilterChange={(f) => {
          setOppFilters(f);
          setOppPage(1);
        }}
        onResetFilters={() => {
          setOppFilters(INITIAL_OPP_FILTERS);
          setOppPage(1);
        }}
        selectedOpportunityId={selectedOpportunity?.opportunity_id || null}
        onSelectOpportunity={handleSelectOpportunity}
        availableSections={availableSections}
        isLoading={opportunitiesQuery.isLoading && !opportunitiesQuery.data}
        isError={opportunitiesQuery.isError}
        errorMessage={
          opportunitiesQuery.error instanceof Error
            ? opportunitiesQuery.error.message
            : undefined
        }
        onRetry={() => opportunitiesQuery.refetch()}
      />

      {/* 4. Candidate Windows Timeline */}
      {pagedCandidates.length > 0 && (
        <CandidateTimeline
          candidates={pagedCandidates}
          selectedCandidateId={selectedCandidate?.candidate_id || null}
          onSelectCandidate={handleSelectCandidate}
          sectionId={candFilters.sectionId || undefined}
        />
      )}

      {/* 5. Section 2: Candidate Block Explorer */}
      <CandidateBlockExplorer
        candidates={pagedCandidates}
        totalCandidates={totalFilteredCandidates}
        page={candPage}
        pageSize={candPageSize}
        totalPages={candTotalPages}
        onPageChange={(p) => setCandPage(p)}
        filters={candFilters}
        onFilterChange={(f) => {
          setCandFilters(f);
          setCandPage(1);
        }}
        onResetFilters={() => {
          setCandFilters(INITIAL_CAND_FILTERS);
          setCandPage(1);
        }}
        selectedCandidateId={selectedCandidate?.candidate_id || null}
        onSelectCandidate={handleSelectCandidate}
        availableSections={availableSections}
        isLoading={candidatesQuery.isLoading && !candidatesQuery.data}
        isError={candidatesQuery.isError}
        errorMessage={
          candidatesQuery.error instanceof Error
            ? candidatesQuery.error.message
            : undefined
        }
        onRetry={() => candidatesQuery.refetch()}
      />

      {/* 6. Drawers */}
      <OpportunityDetailDrawer
        opportunity={selectedOpportunity}
        isOpen={isOppDrawerOpen}
        onClose={() => setIsOppDrawerOpen(false)}
        onFilterCandidatesForOpportunity={handleFilterCandidatesForOpp}
      />

      <CandidateDetailDrawer
        candidate={selectedCandidate}
        isOpen={isCandDrawerOpen}
        onClose={() => setIsCandDrawerOpen(false)}
      />
    </div>
  );
}

export default function PlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState message="Loading planning workspace..." rows={6} />
        </div>
      }
    >
      <PlanningContent />
    </Suspense>
  );
}
