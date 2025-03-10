/*
 * Copyright (C) 2017 VSCT
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AfterViewInit, Component, EventEmitter, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatPaginator, MatSnackBar, MatSnackBarConfig} from "@angular/material";
import {DataSource} from "@angular/cdk/collections";
import {BehaviorSubject, merge, Observable, Subscription} from "rxjs";
import {EntityTestError, TestErrorQuery} from "../model/nlp";
import {StateService} from "../core-nlp/state.service";
import {Router} from "@angular/router";
import {QualityService} from "../quality-nlp/quality.service";
import {escapeRegex} from "../model/commons";

@Component({
  selector: 'tock-test-entity-error',
  templateUrl: './test-entity-error.component.html',
  styleUrls: ['./test-entity-error.component.css']
})
export class TestEntityErrorComponent implements OnInit, AfterViewInit, OnDestroy {

  displayedColumns = ['text', 'intent', 'error', 'count', 'percent', 'probability', 'firstErrorDate', 'actions'];
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  dataSource: TestEntityErrorDataSource | null;
  private subscription: Subscription;

  constructor(public state: StateService,
              private quality: QualityService,
              private snackBar: MatSnackBar,
              private router: Router) {
  }

  ngOnInit(): void {
    this.dataSource = new TestEntityErrorDataSource(this.paginator, this.state, this.quality);
    this.subscription = this.state.configurationChange.subscribe(_ => this.search());
  }

  ngAfterViewInit(): void {
    this.search();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }


  search() {
    this.dataSource.refresh();
  }

  intentName(error: EntityTestError) {
    const i = this.state.findIntentById(error.originalSentence.classification.intentId);
    return i ? i.intentLabel() : "unknown";
  }

  validate(error: EntityTestError) {
    this.quality.deleteEntityError(error).subscribe(
      e => {
        this.snackBar.open(`Sentence validated`, "Validate Entities", {duration: 1000} as MatSnackBarConfig)
        this.dataSource.refresh()
      }
    )
  }

  change(error: EntityTestError) {
    this.quality.deleteEntityError(error).subscribe(
      e => {
        this.router.navigate(
          ['/nlp/search'],
          {
            queryParams: {
              text: "^" + escapeRegex(error.sentence.text) + "$",
              status: "model"
            }
          }
        );
      }
    )
  }
}

export class TestEntityErrorDataSource extends DataSource<EntityTestError> {

  intent: string = "";
  size: number = 0;
  private refreshEvent = new EventEmitter();
  private subject = new BehaviorSubject([]);

  constructor(private _paginator: MatPaginator,
              private state: StateService,
              private qualityService: QualityService) {
    super();
  }

  refresh() {
    this.refreshEvent.emit(true);
  }

  /** Connect function called by the table to retrieve one stream containing the data to render. */
  connect(): Observable<EntityTestError[]> {
    const displayDataChanges = [
      this._paginator.page,
      this.refreshEvent
    ];

    merge(...displayDataChanges).subscribe(() => {
      const startIndex = this._paginator.pageIndex * this._paginator.pageSize;

      this.qualityService.searchEntityErrors(
        TestErrorQuery.create(
          this.state,
          startIndex,
          this._paginator.pageSize,
          this.intent === "" ? undefined : this.intent
        )
      ).subscribe(r => {
        this.size = r.total;
        this.subject.next(r.data);
      });
    });

    return this.subject;
  }

  disconnect() {
  }
}
