import * as XLSX from 'xlsx';

export const exportToExcel = (data, filename) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FactoryMind");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportGanttCSV = () => {
  const csvData = [
    ["Machine", "Start Date", "End Date", "Task", "Status"],
    ["Machine 1", "Wed 9AM", "Thu 2PM", "Gaskets", "On Track"],
    ["Machine 2", "Wed 9AM", "Wed 5PM", "Brake Pads", "Complete"],
    ["Machine 2", "Wed 6PM", "Thu 12PM", "Clutch Plates", "At Risk"],
    ["Machine 3", "Blocked", "Blocked", "Blocked", "Blocked"]
  ];
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + csvData.map(e => e.join(",")).join("\n");
    
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "production_schedule.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
