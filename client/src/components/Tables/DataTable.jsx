import TableHeader from "./TableHeader.jsx";
import "./DataTable.css";

export default function DataTable({ columns, data, renderRow }) {
  return (
    <div className="data-table">
      <table>
        <TableHeader columns={columns} />
        <tbody>{data.map((item) => renderRow(item))}</tbody>
      </table>
    </div>
  );
}
