import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  ScheduleComponent,
  Week,
  Month,
  TimelineViews,
  TimelineMonth,
  Inject,
  ViewsDirective,
  ViewDirective,
} from "@syncfusion/ej2-react-schedule";
import "@syncfusion/ej2-react-schedule/styles/material.css";

// --- CONFIGURATION ---
// const APP_LINK_NAME = "YOUR_APP_LINK_NAME_HERE"; // <--- REPLACE THIS
const REPORT_NAME = "Appointment_Details_Test";

const Calender = () => {
  const [data, setData] = useState([]);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const zohoInitPromiseRef = useRef(null);

  const ensureZohoReady = async () => {
    if (!window.ZOHO?.CREATOR) {
      throw new Error("Zoho Creator SDK not available on window.");
    }

    if (!zohoInitPromiseRef.current) {
      if (typeof window.ZOHO.CREATOR.init === "function") {
        zohoInitPromiseRef.current = window.ZOHO.CREATOR.init().then(
          (result) => {
            if (result?.CREATOR) {
              return result.CREATOR;
            }
            if (result) {
              return result;
            }
            return window.ZOHO.CREATOR;
          }
        );
      } else {
        zohoInitPromiseRef.current = Promise.resolve(window.ZOHO.CREATOR);
      }
    }

    return zohoInitPromiseRef.current;
  };

  const getCreatorModule = (creatorObj, moduleName) => {
    const candidates = [
      creatorObj,
      window.ZOHO?.CREATOR,
      window.ZOHO?.CreatorSDK,
      window.ZOHO,
      window,
    ];
    for (const candidate of candidates) {
      if (candidate?.[moduleName]) {
        return candidate[moduleName];
      }
      if (candidate?.CREATOR?.[moduleName]) {
        return candidate.CREATOR[moduleName];
      }
    }
    return null;
  };

  const resolveUpdateHandler = (creatorObj) => {
    const methodNames = ["updateRecord", "editRecord", "update"];
    const modulesToCheck = [
      creatorObj,
      creatorObj?.API,
      creatorObj?.DATA,
      creatorObj?.CREATOR,
      creatorObj?.CREATOR?.API,
      creatorObj?.CREATOR?.DATA,
      window.ZOHO?.CREATOR,
      window.ZOHO?.CREATOR?.API,
      window.ZOHO?.CREATOR?.DATA,
      window.ZOHO?.CreatorSDK,
      window.ZOHO?.CreatorSDK?.API,
      window.ZOHO?.CreatorSDK?.DATA,
      window.ZCAPI,
      window.ZCAPI?.API,
      window.ZCAPI?.DATA,
    ];

    for (const module of modulesToCheck) {
      if (!module) continue;
      for (const method of methodNames) {
        if (typeof module[method] === "function") {
          return { namespace: module, method };
        }
      }
    }

    return null;
  };


  // --- HELPER: Date Parser (Zoho String -> JS Date) ---
  const parseZohoDate = (dateStr) => {
    if (!dateStr) return null;
    // Expected format: DD-MM-YYYY HH:mm[:ss] [AM|PM]
    const parts = dateStr.trim().split(" ");
    const [day, month, year] = parts[0].split("-");
    const timePart = parts[1] || "00:00:00";
    const meridiem = parts[2] ? parts[2].toUpperCase() : null;
    let [hours, minutes = "00", seconds = "00"] = timePart.split(":");
    let hourNum = parseInt(hours, 10);

    if (meridiem) {
      if (meridiem === "PM" && hourNum !== 12) {
        hourNum += 12;
      } else if (meridiem === "AM" && hourNum === 12) {
        hourNum = 0;
      }
    }

    const isoString = `${year}-${month}-${day}T${hourNum
      .toString()
      .padStart(2, "0")}:${minutes}:${seconds || "00"}`;
    return new Date(isoString);
  };

  // --- 1. FETCH DATA (Init) ---
  useEffect(() => {
    const initWidget = async () => {
  
      // PRODUCTION LOGIC
      try {

        const config = {
          // appName: APP_LINK_NAME,
          report_name: REPORT_NAME,
        };

        const creator = await ensureZohoReady();
        const dataModule = getCreatorModule(creator, "DATA");
        if (!dataModule?.getRecords) {
          throw new Error("Zoho DATA.getRecords API unavailable.");
        }
        const response = await dataModule.getRecords(config);
        console.log("123");
        
        console.log("Fetch Response:", response);

        if (response && response.data) {
          const formattedData = response.data.map((record, index) => ({
            Id: index + 1, // Syncfusion UI ID
            ZohoId: record.ID, // Actual Zoho Record ID (Critical for updates)
            Subject: record.Event_Notes ? record.Event_Notes.replace(/<\/?[^>]+(>|$)/g, "") : "",
            StartTime: parseZohoDate(record.Event_Start_Date_Time),
            EndTime: parseZohoDate(record.Event_End_Date_Time),
            CategoryColor: "#1aaa55",
            
            index: index + 1, // Syncfusion UI ID
            ID: record.ID, // Actual Zoho Record ID (Critical for updates)
            Event_Notes: record.Event_Notes ? record.Event_Notes.replace(/<\/?[^>]+(>|$)/g, "") : "",
            Event_Start_Date_Time: parseZohoDate(record.Event_Start_Date_Time),
            Event_End_Date_Time: parseZohoDate(record.Event_End_Date_Time),
            Event_Type: record.Event_Type,
            Appointment_Status:record.Appointment_Status,
            Appointment_Type:record.Appointment_Type,
            // Client: record.Client,
            // Service:record.Service
          }));
          setData(formattedData);
        }
      } catch (err) {
        console.error("Init/Fetch Error:", err);
      }
    };

    initWidget();

    // Resize Handler
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

 // --- 2. UPDATE RECORD (ActionBegin) ---
 // --- 2. UPDATE RECORD (ActionBegin) ---
const onActionBegin = async (args) => {
  console.log("args" + JSON.stringify(args));
  
  if (args.requestType !== "eventChange") {
    return;
  }

  const eventData = Array.isArray(args.data) ? args.data[0] : args.data;
  if (!eventData) {
    console.error("No event data supplied for update.");
    return;
  }

  const recordId = eventData.ZohoId || eventData.ID || eventData.Id;
  if (!recordId) {
    console.error(
      "Unable to determine the Zoho record ID for the updated event.",
      eventData
    );
    return;
  }

  const updateConfig = {
    // appName: APP_LINK_NAME,
    reportName: REPORT_NAME,
    report_name: REPORT_NAME,
    id: recordId,
    data: eventData
  };

  try {
    const creator = await ensureZohoReady();
    // const handler = resolveUpdateHandler(creator);
    // if (!handler) {
    //    console.error("Zoho update API is not available in this environment.");
    //   console.log("Available ZOHO namespaces:", {
    //     creator,
    //     ZOHO: window.ZOHO,
    //     ZCAPI: window.ZCAPI,
    //   });
    //   return;
    // }
    window.ZOHO.CREATOR.init()
window.ZOHO.CREATOR.API.updateRecord(updateConfig).then(function(response){
    if(response.code == 3000){
        console.log("Record updated successfully");
    } else{
      console.log("Record updated successfully");
    }
});

    // // const response = await handler.namespace[handler.method](updateConfig);
    // if (response?.code === 3000) {
    //   console.log("Zoho Record Updated Successfully");
    // } else {
    //   console.error("Zoho Update Failed:", response);
    // }
  } catch (error) {
    console.error("API Error during update call:", error);
  }
};

  const eventSettings = { dataSource: data };

  return (
    <div className="schedule-container">
      <h2>Appointment Calender</h2>
      <ScheduleComponent
        width={viewportWidth}
        height={viewportHeight}
        selectedDate={new Date()}
        eventSettings={eventSettings}
        actionBegin={onActionBegin} // <--- Links the Update Logic
      >
        
        <ViewsDirective>
          <ViewDirective option="Today" />
          <ViewDirective option="Week" />
          <ViewDirective option="Month" />
        </ViewsDirective>
        <Inject services={[Week, Month, TimelineViews, TimelineMonth]} />
      </ScheduleComponent>
    </div>
  );
};

export default Calender;