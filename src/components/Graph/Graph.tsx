import dynamic from "next/dynamic";
import { useContext, useEffect, useState } from "react";
import {
  ApolloClient,
  InMemoryCache,
  gql,
  ApolloQueryResult,
} from "@apollo/client";
import { ResponsiveBar } from "@nivo/bar";

import { ColorSchemeContext } from "src/contexts/colorSchemeToggle/colorSchemeContext";
import { QueriesContext } from "src/contexts/queries/queries";

import { Query } from "src/types/peterportal";

const client = new ApolloClient({
  uri: "https://api.peterportal.org/graphql/",
  cache: new InMemoryCache(),
});

// https://github.com/plouc/nivo/pull/1886
// @ts-ignore
const DynamicComponent: typeof ResponsiveBar = dynamic(
  () => import("@nivo/bar").then((mod) => mod.ResponsiveBar),
  { ssr: false }
);

const GET_GRADES = gql`
  query GetGrades(
    $year: String!
    $quarter: String!
    $instructor: String!
    $department: String!
    $number: String!
    $code: String!
    $division: String!
  ) {
    grades(
      year: $year
      quarter: $quarter
      instructor: $instructor
      department: $department
      number: $number
      code: $code
      division: $division
    ) {
      aggregate {
        sum_grade_a_count
        sum_grade_b_count
        sum_grade_c_count
        sum_grade_d_count
        sum_grade_f_count
        sum_grade_p_count
        sum_grade_np_count
        average_gpa
        count
      }
    }
  }
`;

const optionsDark = {
  theme: {
    textColor: "#ffffff",
    tooltip: {
      container: {
        background: "#000000",
        color: "#ffffff",
        fontSize: 12,
      },
    },
    grid: {
      line: {
        stroke: "#313233",
      },
    },
  },
};
const optionsLight = {
  theme: {
    grid: {
      line: {
        stroke: "#e5e7eb",
      },
    },
  },
};

interface gradeValue {
  id: "A" | "B" | "C" | "D" | "F" | "P" | "NP";
  [key: string]: number | string;
}

// bar colors if there is only one search query
const letterGradeBarColor = (opacity: number) => `rgba(54, 162, 235, ${opacity})`;
const pnpBarColor = (opacity: number) => `rgba(255, 206, 86, ${opacity})`;

const chartColorsSingleDark = Array(5)
  .fill(letterGradeBarColor(0.9))
  .concat(Array(2).fill(pnpBarColor(0.9)));

const chartColorsSingleLight = Array(5)
  .fill(letterGradeBarColor(0.7))
  .concat(Array(2).fill(pnpBarColor(0.7)));

const chartColorsMultipleDark = [
  "rgba(34, 87, 122, 0.9)",
  "rgba(56, 163, 165, 0.9)",
  "rgba(87, 204, 153, 0.9)",
  "rgba(128, 237, 153, 0.9)",
  "rgba(199, 249, 204, 0.9)",
];

const chartColorsMultipleLight = [
  "rgba(34, 87, 122, 0.7)",
  "rgba(56, 163, 165, 0.7)",
  "rgba(87, 204, 153, 0.7)",
  "rgba(128, 237, 153, 0.7)",
  "rgba(199, 249, 204, 0.7)",
];

const Graph = () => {
  const { queries, updateQueryState } = useContext(QueriesContext);

  const [queryIdsValue, setQueryIdsValue] = useState<number[]>([]);
  const [gradeValues, setGradeValues] = useState<gradeValue[]>([]);
  const [gradeValuesRaw, setGradeValuesRaw] = useState<gradeValue[]>([]);

  const { colorScheme } = useContext(ColorSchemeContext);

  const props = colorScheme === "dark" ? optionsDark : optionsLight;

  useEffect(() => {
    const queryIds: number[] = [];
    queries.forEach((_value, key) => {
      queryIds.push(key);
    });
    setQueryIdsValue(queryIds);
  }, [queries]);

  useEffect(() => {
    const graphQueries: Promise<ApolloQueryResult<Query>>[] = [];
    queries.forEach(async (query, key) => {
      updateQueryState(key, "loading", true);
      graphQueries.push(
        client
          .query({
            query: GET_GRADES,
            variables: {
              year: query.years.map(({ value }) => value).join(";"),
              quarter: query.quarters.map(({ value }) => value).join(";"),
              instructor: query.instructors.map(({ value }) => value).join(";"),
              department: query.departments.map(({ value }) => value).join(";"),
              number: query.courseNumber.map(({ value }) => value).join(";"),
              code: query.courseCode.map(({ value }) => value).join(";"),
              division: query.division
            },
          })
          .then((query) => {
            updateQueryState(key, "loading", false);
            return query;
          })
      );
    });
    Promise.all(graphQueries).then((values) => {
      const newGradeValues: gradeValue[] = [
        { id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "F" }, { id: "P" }, { id: "NP" },
      ];

      const newGradeValuesRaw: gradeValue[] = [
        { id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "F" }, { id: "P" }, { id: "NP" },
      ];

      values.map(({ data }, i) => {
        const gradeValue: number[] = [];
        const gradesAggregate = data.grades.aggregate;
        const total =
          gradesAggregate.sum_grade_a_count +
          gradesAggregate.sum_grade_b_count +
          gradesAggregate.sum_grade_c_count +
          gradesAggregate.sum_grade_d_count +
          gradesAggregate.sum_grade_f_count +
          gradesAggregate.sum_grade_p_count +
          gradesAggregate.sum_grade_np_count;
        gradeValue.push(data.grades.aggregate.sum_grade_a_count);
        gradeValue.push(data.grades.aggregate.sum_grade_b_count);
        gradeValue.push(data.grades.aggregate.sum_grade_c_count);
        gradeValue.push(data.grades.aggregate.sum_grade_d_count);
        gradeValue.push(data.grades.aggregate.sum_grade_f_count);
        gradeValue.push(data.grades.aggregate.sum_grade_p_count);
        gradeValue.push(data.grades.aggregate.sum_grade_np_count);
        // This is probably a little hacky? but it works for now.
        // Basically it relies on the fact that the order of the results are the same as the ids, which should always be the case because they're both derived from the query context.
        newGradeValues.forEach((newGradeValue, j) => {
          newGradeValue[queryIdsValue[i]] = gradeValue[j] / total;
        });
        newGradeValuesRaw.forEach((newGradeValue, j) => {
          newGradeValue[queryIdsValue[i]] = gradeValue[j];
        });
      });
      setGradeValues(newGradeValues);
      setGradeValuesRaw(newGradeValuesRaw);
    });
  }, [queryIdsValue, queries]);

  const barColors = () => {
    if (queries.size === 1) {
      if (colorScheme === "dark") {
        return chartColorsSingleDark;
      }
      return chartColorsSingleLight;
    } else {
      if (colorScheme === "dark") {
        return chartColorsMultipleDark;
      }
      return chartColorsMultipleLight;
    }
  };

  return (
    <DynamicComponent
      data={gradeValues}
      keys={queryIdsValue.map((id) => id.toString())}
      groupMode="grouped"
      margin={{
        top: 0,
        bottom: 30,
        left: 50,
        right: 50,
      }}
      axisLeft={{
        legend: "% of Students",
        legendPosition: "middle",
        legendOffset: -40,
      }}
      valueFormat=">-.2%"
      colors={barColors()}
      colorBy={queries.size === 1 ? "indexValue" : "id"}
      padding={0.25}
      innerPadding={6}
      borderRadius={4}
      tooltip={({id, value, index, indexValue, color}) => (
          <div className="flex flex-col items-center shadow rounded-sm p-1.5 text-xs text-black bg-neutral-50 dark:text-white dark:bg-neutral-900">
            <div className="flex flex-row items-center">
              <div
                  className="h-[11px] w-[11px] mr-1"
                  style={{ backgroundColor: color }}
              />
              <span className="pr-1"><strong>{indexValue}</strong></span>
            </div>
            <div className="border-b-[1px] w-full mb-0.5" />
            <span>{(value*100).toFixed(2)}%</span>
            <span>{gradeValuesRaw[index][id]} Students</span>
          </div>
      )}
      {...props}
    />
  );
};

export default Graph;
